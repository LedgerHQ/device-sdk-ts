/* eslint-disable no-restricted-imports */
import { type MockClient } from "@ledgerhq/device-mockserver-client";
import { test as base } from "@playwright/test";

import { CommandsDriver } from "./utils/drivers/CommandsDriver";
import { DeviceDriver } from "./utils/drivers/DeviceDriver";
import { EthSignerDriver } from "./utils/drivers/EthSignerDriver";
import { SettingsDriver } from "./utils/drivers/SettingsDriver";
import { setupMockServerSession } from "./utils/setup";

type Fixtures = {
  mockClient: MockClient;
  device: DeviceDriver;
  commands: CommandsDriver;
  settings: SettingsDriver;
  ethSigner: EthSignerDriver;
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
  mockClient: async ({ page }, use) => {
    const client = await setupMockServerSession(page);
    await use(client);
    await client.disposeSession();
  },
  device: async ({ page, mockClient }, use) => {
    await use(new DeviceDriver(page, mockClient));
  },
  commands: async ({ page }, use) => {
    await use(new CommandsDriver(page));
  },
  settings: async ({ page }, use) => {
    await use(new SettingsDriver(page));
  },
  ethSigner: async ({ page }, use) => {
    await use(new EthSignerDriver(page));
  },
});

export { expect } from "@playwright/test";
