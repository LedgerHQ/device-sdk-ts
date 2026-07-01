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
  firmware_version: "2.7.1",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

// Open the Ethereum app, declaring its 1inch plugin as a dependency. Both are
// installed (dependencies first) before Ethereum is opened.
const APP_TO_OPEN = "Ethereum";
const DEPENDENCIES = "1inch";

interface OpenAppWithDependenciesResponse {
  status: string;
  output?: {
    installResult: {
      successfullyInstalled: { versionName: string }[];
      alreadyInstalled: string[];
    };
  };
}

interface InstallOrUpdateAppsResponse {
  status: string;
}

test.describe("device action: open app with dependencies", () => {
  test("installs the dependencies then opens Ethereum", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected device with only the dashboard", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When Open app with dependencies is executed for Ethereum with 1inch as a dependency", async () => {
      await deviceActions.goto();
      await deviceActions.openAppWithDependencies(APP_TO_OPEN, DEPENDENCIES);
    });

    await test.step("Then it installs the dependencies, opens Ethereum and completes", async () => {
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

  test("skips a dependency that is already installed", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected device that already has the 1inch dependency installed", async () => {
      await device.addAndConnect(NANO_X);
      await deviceActions.goto();
      // Installing the 1inch plugin also installs its Ethereum parent, so both
      // are present in the device context before the open action runs.
      await deviceActions.installOrUpdateApps("1inch");
      const preinstall =
        await deviceActions.lastResponse<InstallOrUpdateAppsResponse>({
          until: '"completed"',
          timeout: 90_000,
        });
      expect(preinstall.status).toBe("completed");
    });

    await test.step("When Open app with dependencies is executed for Ethereum with 1inch, Uniswap and Paraswap as dependencies", async () => {
      await deviceActions.backToList();
      await deviceActions.openAppWithDependencies(
        "Ethereum",
        "1inch,Uniswap,Paraswap",
      );
    });

    await test.step("Then 1inch is reported as already installed while the missing plugins are installed", async () => {
      const response =
        await deviceActions.lastResponse<OpenAppWithDependenciesResponse>({
          until: '"completed"',
          timeout: 120_000,
        });
      expect(response.status).toBe("completed");
      expect(response.output?.installResult.alreadyInstalled).toEqual(
        expect.arrayContaining(["1inch"]),
      );
      const installed =
        response.output?.installResult.successfullyInstalled.map(
          (app) => app.versionName,
        );
      expect(installed).toEqual(
        expect.arrayContaining(["Uniswap", "Paraswap"]),
      );
    });
  });

  test("opens directly when the app and its dependency are already installed", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected device that already has Ethereum and 1inch installed", async () => {
      await device.addAndConnect(NANO_X);
      await deviceActions.goto();
      await deviceActions.installOrUpdateApps("Ethereum,1inch");
      const preinstall =
        await deviceActions.lastResponse<InstallOrUpdateAppsResponse>({
          until: '"completed"',
          timeout: 90_000,
        });
      expect(preinstall.status).toBe("completed");
    });

    await test.step("When Open app with dependencies is executed for Ethereum with 1inch as a dependency", async () => {
      await deviceActions.backToList();
      await deviceActions.openAppWithDependencies("Ethereum", "1inch");
    });

    await test.step("Then nothing is installed and it opens Ethereum", async () => {
      const response =
        await deviceActions.lastResponse<OpenAppWithDependenciesResponse>({
          until: '"completed"',
          timeout: 120_000,
        });
      expect(response.status).toBe("completed");
      // Everything is already present, so the install plan installs nothing.
      expect(response.output?.installResult.successfullyInstalled).toEqual([]);
      expect(response.output?.installResult.alreadyInstalled).toEqual(
        expect.arrayContaining(["Ethereum", "1inch"]),
      );
    });
  });

  test("installs four dependencies then opens Ethereum", async ({
    device,
    deviceActions,
  }) => {
    const FOUR_DEPENDENCIES = "1inch,Uniswap,Paraswap,Angle";

    await test.step("Given a connected device with only the dashboard", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When Open app with dependencies is executed for Ethereum with four dependencies", async () => {
      await deviceActions.goto();
      await deviceActions.openAppWithDependencies(
        "Ethereum",
        FOUR_DEPENDENCIES,
      );
    });

    await test.step("Then all four dependencies plus Ethereum are installed and it opens", async () => {
      const response =
        await deviceActions.lastResponse<OpenAppWithDependenciesResponse>({
          until: '"completed"',
          timeout: 180_000,
        });
      expect(response.status).toBe("completed");
      const installed =
        response.output?.installResult.successfullyInstalled.map(
          (app) => app.versionName,
        );
      expect(installed).toEqual(
        expect.arrayContaining([
          "Ethereum",
          "1inch",
          "Uniswap",
          "Paraswap",
          "Angle",
        ]),
      );
    });
  });

  test("fails with RefusedByUserDAError when the secure connection is refused", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected device that declines the secure connection", async () => {
      dev = await device.addAndConnect(NANO_X);
      // The action opens a secure channel (metadata + install) via the permission
      // APDU (0xE0 0x51); decline it as if the user rejected the prompt (5501).
      await mockClient.addMock(dev.id, { prefix: "e051", response: "5501" });
    });

    await test.step("When Open app with dependencies is executed for Ethereum with 1inch as a dependency", async () => {
      await deviceActions.goto();
      await deviceActions.openAppWithDependencies("Ethereum", "1inch");
    });

    await test.step("Then it fails with RefusedByUserDAError", async () => {
      const error = await deviceActions.expectError("RefusedByUserDAError", {
        timeout: 60_000,
      });
      expect(error).toContain("RefusedByUserDAError");
    });
  });

  test("fails with OutOfMemoryDAError when a dependency install runs out of memory", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected device that runs out of memory while installing", async () => {
      dev = await device.addAndConnect(NANO_X);
      // Override the synthetic install-block APDUs (0xE0 0xF0) so the device
      // reports out-of-memory (6a84) during the dependency install bulk stream.
      await mockClient.addMock(dev.id, { prefix: "e0f0", response: "6a84" });
    });

    await test.step("When Open app with dependencies is executed for Ethereum with 1inch as a dependency", async () => {
      await deviceActions.goto();
      await deviceActions.openAppWithDependencies("Ethereum", "1inch");
    });

    await test.step("Then it fails with OutOfMemoryDAError before opening", async () => {
      const error = await deviceActions.expectError("OutOfMemoryDAError", {
        timeout: 60_000,
      });
      expect(error).toContain("OutOfMemoryDAError");
    });
  });
});
