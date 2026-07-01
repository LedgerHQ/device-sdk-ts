/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

// Open app with dependencies chains three sub-actions: it reads the device
// metadata, runs Install or update applications for `[...dependencies,
// application]` (streaming a secure-channel install for each missing app), then
// opens the target app.
//
// The install steps are resolved against the live Manager API and the mock
// server's secure channel (like install-or-update-apps). The final open step is
// different: the mock server intercepts the Open App APDU (0xE0 0xD8) and
// provisions a REAL Speculos instance through its Speculinho proxy (defaults to
// https://speculinho.ledgerlabs.net). This spec therefore requires access to
// that backend — it is not a pure-mock, CI-safe flow like the other
// secure-channel specs.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

// Open the 1inch plugin, which depends on the Ethereum app. Both are declared as
// dependencies so they are installed before 1inch is opened.
const APP_TO_OPEN = "1inch";
const DEPENDENCIES = "Ethereum,1inch";

interface OpenAppWithDependenciesResponse {
  status: string;
  output?: {
    installResult: { successfullyInstalled: { versionName: string }[] };
  };
}

test.describe("device action: open app with dependencies", () => {
  test("installs the dependencies then opens 1inch", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected device with only the dashboard", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When Open app with dependencies is executed for 1inch with Ethereum and 1inch as dependencies", async () => {
      await deviceActions.goto();
      await deviceActions.openAppWithDependencies(APP_TO_OPEN, DEPENDENCIES);
    });

    await test.step("Then it installs the dependencies, opens 1inch and completes", async () => {
      // Completing requires the secure-channel installs to succeed and the Open
      // App step to acquire a Speculos instance, so allow ample time.
      const response =
        await deviceActions.lastResponse<OpenAppWithDependenciesResponse>({
          until: '"completed"',
          timeout: 120_000,
        });
      expect(response.status).toBe("completed");
      const installed =
        response.output?.installResult.successfullyInstalled.map(
          (app) => app.versionName,
        );
      expect(installed).toEqual(expect.arrayContaining(["Ethereum", "1inch"]));
    });
  });
});
