import {
  type Device,
  type DeviceConfig,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

/**
 * Drives the mocked device: attaching a mocked device to the session and
 * connecting to it from the sample app.
 */
export class MockDeviceDriver {
  constructor(
    private readonly page: Page,
    private readonly client: MockClient,
  ) {}

  /** Attach a mocked device to the current session. */
  add(config: DeviceConfig): Promise<Device> {
    return this.client.addDevice(config);
  }

  /** Open the app, select the transport device and wait until it is connected. */
  async connect(transport: string = "MOCKSERVER"): Promise<void> {
    await this.page.goto(BASE_URL);
    await this.page.getByTestId(`CTA_select-device-${transport}`).click();
    await expect(
      this.page.getByTestId("text_device-connection-status").first(),
    ).toContainText("CONNECTED");
  }

  /** Attach a device and immediately connect to it. */
  async addAndConnect(
    config: DeviceConfig,
    transport: string = "MOCKSERVER",
  ): Promise<Device> {
    const device = await this.add(config);
    await this.connect(transport);
    return device;
  }
}
