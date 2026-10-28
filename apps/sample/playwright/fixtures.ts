import {
  type Device,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { test as base } from "@playwright/test";

import { AleoSignerDriver } from "./utils/drivers/AleoSignerDriver";
import { BtcLegacySignerDriver } from "./utils/drivers/BtcLegacySignerDriver";
import { BtcSignerDriver } from "./utils/drivers/BtcSignerDriver";
import { CommandsDriver } from "./utils/drivers/CommandsDriver";
import { CosmosSignerDriver } from "./utils/drivers/CosmosSignerDriver";
import { DeviceActionsDriver } from "./utils/drivers/DeviceActionsDriver";
import { EthSignerDriver } from "./utils/drivers/EthSignerDriver";
import { HyperliquidSignerDriver } from "./utils/drivers/HyperliquidSignerDriver";
import { MockDeviceDriver } from "./utils/drivers/MockDeviceDriver";
import { PolkadotSignerDriver } from "./utils/drivers/PolkadotSignerDriver";
import { SettingsDriver } from "./utils/drivers/SettingsDriver";
import { SidebarDriver } from "./utils/drivers/SidebarDriver";
import { SolSignerDriver } from "./utils/drivers/SolSignerDriver";
import { SpeculosDriver } from "./utils/drivers/SpeculosDriver";
import { TrxSignerDriver } from "./utils/drivers/TrxSignerDriver";
import { XrpSignerDriver } from "./utils/drivers/XrpSignerDriver";
import { ZcashSignerDriver } from "./utils/drivers/ZcashSignerDriver";
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
  ltcSigner: BtcLegacySignerDriver;
  dogeSigner: BtcLegacySignerDriver;
  solSigner: SolSignerDriver;
  cosmosSigner: CosmosSignerDriver;
  polkadotSigner: PolkadotSignerDriver;
  aleoSigner: AleoSignerDriver;
  zcashSigner: ZcashSignerDriver;
  hyperliquidSigner: HyperliquidSignerDriver;
  trxSigner: TrxSignerDriver;
  xrpSigner: XrpSignerDriver;
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
  ltcSigner: async ({ page }, use) => {
    await use(new BtcLegacySignerDriver(page, "Litecoin"));
  },
  dogeSigner: async ({ page }, use) => {
    await use(new BtcLegacySignerDriver(page, "Dogecoin"));
  },
  solSigner: async ({ page }, use) => {
    await use(new SolSignerDriver(page));
  },
  cosmosSigner: async ({ page }, use) => {
    await use(new CosmosSignerDriver(page));
  },
  polkadotSigner: async ({ page }, use) => {
    await use(new PolkadotSignerDriver(page));
  },
  aleoSigner: async ({ page }, use) => {
    await use(new AleoSignerDriver(page));
  },
  zcashSigner: async ({ page }, use) => {
    await use(new ZcashSignerDriver(page));
  },
  hyperliquidSigner: async ({ page }, use) => {
    await use(new HyperliquidSignerDriver(page));
  },
  trxSigner: async ({ page }, use) => {
    await use(new TrxSignerDriver(page));
  },
  xrpSigner: async ({ page }, use) => {
    await use(new XrpSignerDriver(page));
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
