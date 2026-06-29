/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

// Install or update applications resolves a list of apps against the Manager
// API, builds an install plan, then streams a secure-channel install for each
// missing app. Each install hash is resolved to its app by the mock (like the
// real ScriptRunner backend) and added to the device context. The action
// reports the planned installs, so this must be real apps on a real firmware.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

const APPS_TO_INSTALL = "Bitcoin,Ethereum";

interface InstallOrUpdateAppsResponse {
  status: string;
  output?: { successfullyInstalled: { versionName: string }[] };
}

test.describe("device action: install or update applications", () => {
  test("installs the requested apps that are missing", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected device with only the dashboard", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When Install or update applications is executed for Bitcoin and Ethereum", async () => {
      await deviceActions.goto();
      await deviceActions.installOrUpdateApps(APPS_TO_INSTALL);
    });

    await test.step("Then it completes and reports both apps as installed", async () => {
      const response =
        await deviceActions.lastResponse<InstallOrUpdateAppsResponse>({
          until: '"completed"',
          timeout: 90_000,
        });
      expect(response.status).toBe("completed");
      const installed = response.output?.successfullyInstalled.map(
        (app) => app.versionName,
      );
      expect(installed).toEqual(
        expect.arrayContaining(["Bitcoin", "Ethereum"]),
      );
    });
  });
});
