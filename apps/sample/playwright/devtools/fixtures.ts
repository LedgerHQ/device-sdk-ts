import {
  type Device,
  type DeviceConfig,
} from "@ledgerhq/device-mockserver-client";
import { expect, type Locator, type Page } from "@playwright/test";

import { test as base } from "@root/playwright/fixtures";

import { DevToolsDriver } from "./DevToolsDriver";

export const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.4.0",
  apps: [{ name: "BOLOS", version: "2.4.0" }],
  masks: [0x33000000],
};

/** The sample app, served on the devtools config `baseURL`. */
export class SampleDriver {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  async connect(): Promise<void> {
    await this.page.getByTestId("CTA_select-device-MOCKSERVER").click();
    await expect(this.connectionStatus.first()).toHaveText(
      /^(?:CONNECTED|BUSY)$/,
      { timeout: 15_000 },
    );
  }

  get connectionStatus(): Locator {
    return this.page.getByTestId("text_device-connection-status");
  }

  async disconnect(): Promise<void> {
    await this.page.getByTestId("dropdown_device-option").first().click();
    await this.page.getByTestId("CTA_disconnect-device").first().click();
  }

  /** Run a command from the Commands page and wait for its response. */
  async runCommand(
    command: string,
    input?: { field: string; value: string },
  ): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/commands").click();
    await this.page.waitForURL("**/commands");
    await this.page.getByTestId(`CTA_command-${command}`).click();
    if (input) {
      await this.page.getByTestId(input.field).fill(input.value);
    }
    await this.page.getByTestId("CTA_send-device-command").click();
    await expect(
      this.page.getByTestId("box_device-commands-responses"),
    ).toContainText('"status"', { timeout: 15_000 });
  }
}

type DevToolsFixtures = {
  devtools: DevToolsDriver;
  /** Close the running DevTools app and start it again with the same profile. */
  restartDevtools: () => Promise<DevToolsDriver>;
  sample: SampleDriver;
  /** Attach a mocked device, open the sample and connect to it. */
  connectDevice: (config?: DeviceConfig) => Promise<Device>;
};

/**
 * Sample fixtures plus the DevTools Electron app. `devtools` is set up before
 * `page`, so the relay already listens when the sample loads.
 */
export const test = base.extend<DevToolsFixtures>({
  // eslint-disable-next-line no-empty-pattern
  devtools: async ({}, use, testInfo) => {
    const devtools = await DevToolsDriver.launch(
      testInfo.outputPath("user-data"),
    );
    await use(devtools);
    await devtools.close();
  },
  restartDevtools: async ({ devtools }, use, testInfo) => {
    let current = devtools;
    await use(async () => {
      await current.close();
      current = await DevToolsDriver.launch(testInfo.outputPath("user-data"));
      return current;
    });
    if (current !== devtools) await current.close();
  },
  sample: async ({ page }, use) => {
    await use(new SampleDriver(page));
  },
  connectDevice: async ({ mockClient, sample }, use) => {
    await use(async (config = NANO_X) => {
      const device = await mockClient.addDevice(config);
      await sample.open();
      await sample.connect();
      return device;
    });
  },
});

export { expect };
