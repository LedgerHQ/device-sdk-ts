import {
  type Device,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { test as base } from "@playwright/test";

import { BtcSignerDriver } from "./utils/drivers/BtcSignerDriver";
import { CommandsDriver } from "./utils/drivers/CommandsDriver";
import { DeviceActionsDriver } from "./utils/drivers/DeviceActionsDriver";
import { EthSignerDriver } from "./utils/drivers/EthSignerDriver";
import { MockDeviceDriver } from "./utils/drivers/MockDeviceDriver";
import { SettingsDriver } from "./utils/drivers/SettingsDriver";
import { SidebarDriver } from "./utils/drivers/SidebarDriver";
import { SpeculosDriver } from "./utils/drivers/SpeculosDriver";
import { setupMockServerSession } from "./utils/setup";

type Fixtures = {
  /**
   * Disable the device-session refresher polling (default: true) so its periodic
   * APDU polling does not pollute the logs. Override per file with
   * `test.use({ disablePolling: false })` for tests that exercise polling.
   */
  disablePolling: boolean;
  mockClient: MockClient;
  device: MockDeviceDriver;
  commands: CommandsDriver;
  deviceActions: DeviceActionsDriver;
  settings: SettingsDriver;
  sidebar: SidebarDriver;
  ethSigner: EthSignerDriver;
  btcSigner: BtcSignerDriver;
  /** Build a Speculos driver for a connected device (its app must be opened). */
  speculos: (device: Device) => SpeculosDriver;
};

/**
 * Playwright test extended with fixtures that inject ready-to-use drivers. The
 * `mockClient` fixture owns the mock server session lifecycle (it seeds the
 * session token before the app loads and disposes the session on teardown).
 *
 * Fixtures are lazy, so a test that does not request `mockClient` (or a driver
 * depending on it) never provisions a session.
 */
export const test = base.extend<Fixtures>({
  disablePolling: [true, { option: true }],
  mockClient: async ({ page, disablePolling }, use) => {
    const client = await setupMockServerSession(page, { disablePolling });
    await use(client);
    await client.disposeSession();
  },
  device: async ({ page, mockClient }, use) => {
    await use(new MockDeviceDriver(page, mockClient));
  },
  commands: async ({ page }, use) => {
    await use(new CommandsDriver(page));
  },
  deviceActions: async ({ page }, use) => {
    await use(new DeviceActionsDriver(page));
  },
  settings: async ({ page }, use) => {
    await use(new SettingsDriver(page));
  },
  sidebar: async ({ page }, use) => {
    await use(new SidebarDriver(page));
  },
  ethSigner: async ({ page }, use) => {
    await use(new EthSignerDriver(page));
  },
  btcSigner: async ({ page }, use) => {
    await use(new BtcSignerDriver(page));
  },
  speculos: async ({ mockClient }, use, testInfo) => {
    const drivers: SpeculosDriver[] = [];
    await use((device: Device) => {
      const driver = new SpeculosDriver(mockClient, device.id, testInfo);
      drivers.push(driver);
      return driver;
    });
    // Always attach each emulator's final screen, then stop the screen log poll.
    for (const driver of drivers) {
      await driver.attachScreenshot("final");
      driver.dispose();
    }
  },
});

export { expect } from "@playwright/test";
