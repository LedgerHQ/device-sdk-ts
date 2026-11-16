/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_ICP: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "InternetComputer", version: "4.2.7" },
  ],
  masks: [0x33200000],
};

interface AppConfigurationOutput {
  version: string;
  testMode: boolean;
  locked: boolean;
}

// A semantic version string, e.g. "4.2.7". The exact value depends on the
// emulated ICP app, so we assert on the shape rather than a fixed version.
const VERSION_RE = /^\d+\.\d+\.\d+$/;

test.describe("signer icp: get app configuration", () => {
  test("returns the ICP app configuration", async ({ device, icpSigner }) => {
    // Opening the ICP app provisions a real Speculos instance, which can take
    // a while to become ready.
    test.setTimeout(120_000);

    await test.step("Given the device with the ICP app is connected", async () => {
      await device.addAndConnect(STAX_WITH_ICP);
    });

    await test.step("When Get app configuration is executed", async () => {
      await icpSigner.open();
      await icpSigner.getAppConfiguration();
    });

    await test.step("Then the app configuration is returned", async () => {
      const result = await icpSigner.lastResult<AppConfigurationOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.version).toMatch(VERSION_RE);
      expect(typeof result.output!.testMode).toBe("boolean");
      expect(typeof result.output!.locked).toBe("boolean");
    });
  });
});
