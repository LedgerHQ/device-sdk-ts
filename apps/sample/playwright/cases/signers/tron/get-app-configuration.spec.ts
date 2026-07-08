/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_TRX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Tron", version: "0.7.4" },
  ],
  masks: [0x33200000],
};

interface AppConfigurationOutput {
  version: string;
  versionN: number;
  allowData: boolean;
  allowContract: boolean;
  truncateAddress: boolean;
  signByHash: boolean;
}

// A semantic version string, e.g. "0.5.0". The exact value depends on the
// emulated Tron app, so we assert on the shape rather than a fixed version.
const VERSION_RE = /^\d+\.\d+\.\d+$/;

test.describe("signer tron: get app configuration", () => {
  test("returns the Tron app configuration", async ({ device, trxSigner }) => {
    // Opening the Tron app provisions a real Speculos instance, which can take
    // a while to become ready.
    test.setTimeout(120_000);

    await test.step("Given the device with the Tron app is connected", async () => {
      await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Get app configuration is executed", async () => {
      await trxSigner.open();
      await trxSigner.getAppConfiguration();
    });

    await test.step("Then the app configuration is returned", async () => {
      const result = await trxSigner.lastResult<AppConfigurationOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.version).toMatch(VERSION_RE);
      expect(typeof result.output!.versionN).toBe("number");
      expect(typeof result.output!.allowData).toBe("boolean");
      expect(typeof result.output!.allowContract).toBe("boolean");
      expect(typeof result.output!.truncateAddress).toBe("boolean");
      expect(typeof result.output!.signByHash).toBe("boolean");
    });
  });
});
