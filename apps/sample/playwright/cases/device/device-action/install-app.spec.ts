/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const APP_TO_INSTALL = "Bitcoin";

// Install runs the secure-channel `install` flow (handshake + a bulk stream of
// install APDUs). The mock server derives the bulk APDUs (0xE0 0xF0) to success
// by default; an explicit mock overrides them to inject a device error. The app
// catalog is still fetched from the live Manager API, so this must be a real
// firmware + a real, not-yet-installed app.
//
// On a successful install the mock resolves the install hash to the app via the
// Manager API (the way the real ScriptRunner backend does) and adds it to the
// device's installed apps, so the post-install re-list reports Bitcoin and the
// action completes — no per-test catalog seeding required.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

// A Stax device on firmware 1.9.1 with only the dashboard installed. The
// target-id mask is derived from the model (stax -> 0x33200000), so it doesn't
// need to be set explicitly.
const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "BLE",
  firmware_version: "1.9.1",
  apps: [{ name: "BOLOS", version: "1.9.1" }],
};

const ETH_APP_TO_INSTALL = "Ethereum";

interface InstallAppResponse {
  status: string;
}

test.describe("device action: install app", () => {
  test("installs Bitcoin successfully via the secure channel", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected device without Bitcoin installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Install App device action is executed for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.installApp(APP_TO_INSTALL);
    });

    await test.step("Then the install completes successfully", async () => {
      // Once the install bulk stream succeeds the device action re-lists the
      // installed apps to confirm the new app is present. This only terminates
      // if the device context now reflects Bitcoin as installed; otherwise the
      // action keeps looping and never reaches a completed state.
      const response = await deviceActions.lastResponse<InstallAppResponse>({
        until: '"completed"',
        timeout: 60_000,
      });
      expect(response.status).toBe("completed");
    });
  });

  test("installs Ethereum successfully on a Stax via the secure channel", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected Stax without Ethereum installed", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Install App device action is executed for Ethereum", async () => {
      await deviceActions.goto();
      await deviceActions.installApp(ETH_APP_TO_INSTALL);
    });

    await test.step("Then the install completes successfully", async () => {
      // Same confirmation loop as the Nano X case: the action only completes if
      // the device context reflects Ethereum as installed after the bulk stream.
      const response = await deviceActions.lastResponse<InstallAppResponse>({
        until: '"completed"',
        timeout: 60_000,
      });
      expect(response.status).toBe("completed");
    });
  });

  test("fails with OutOfMemoryDAError when the device runs out of memory", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected device that runs out of memory while installing", async () => {
      dev = await device.addAndConnect(NANO_X);
      // Override the synthetic install-block APDUs (0xE0 0xF0) so the device
      // reports out-of-memory (6a84) during the install bulk stream.
      await mockClient.addMock(dev.id, { prefix: "e0f0", response: "6a84" });
    });

    await test.step("When the Install App device action is executed for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.installApp(APP_TO_INSTALL);
    });

    await test.step("Then the install fails with OutOfMemoryDAError", async () => {
      const error = await deviceActions.expectError("OutOfMemoryDAError", {
        timeout: 60_000,
      });
      expect(error).toContain("OutOfMemoryDAError");
    });
  });

  test("fails on the 5th install block after the first four succeed", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected device that errors only on the 5th install block", async () => {
      dev = await device.addAndConnect(NANO_X);
      // The install bulk streams several `e0f0` blocks. A sequenced mock answers
      // the first four with success and the 5th with out-of-memory, so the
      // stream fails midway and exercises the partial-progress error path.
      await mockClient.addMock(dev.id, {
        prefix: "e0f0",
        responses: ["9000", "9000", "9000", "9000", "6a84"],
      });
    });

    await test.step("When the Install App device action is executed for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.installApp(APP_TO_INSTALL);
    });

    await test.step("Then progress reaches the 4th of 6 blocks before failing", async () => {
      // Four of the six blocks acknowledged -> 4/6 = 0.67 progress emitted.
      await deviceActions.expectAnyResponseContains('"progress": 0.67', {
        timeout: 60_000,
      });
    });

    await test.step("And the install fails with OutOfMemoryDAError", async () => {
      const error = await deviceActions.expectError("OutOfMemoryDAError", {
        timeout: 60_000,
      });
      expect(error).toContain("OutOfMemoryDAError");
    });
  });
});

test.describe("device action: uninstall app", () => {
  test("uninstalls Bitcoin successfully via the secure channel", async ({
    device,
    deviceActions,
  }) => {
    // Uninstall first resolves the app from the device's installed list (by its
    // Manager-API hash). Rather than seed that hash, install Bitcoin first so the
    // device context holds it with the real hash, then uninstall it.
    await test.step("Given a connected device with Bitcoin installed", async () => {
      await device.addAndConnect(NANO_X);
      await deviceActions.goto();
      await deviceActions.installApp(APP_TO_INSTALL);
      const installed = await deviceActions.lastResponse<InstallAppResponse>({
        until: '"completed"',
        timeout: 60_000,
      });
      expect(installed.status).toBe("completed");
    });

    await test.step("When the Uninstall App device action is executed for Bitcoin", async () => {
      // Selecting Install App hid the action rows; go back to the list first.
      await deviceActions.backToList();
      await deviceActions.uninstallApp(APP_TO_INSTALL);
    });

    await test.step("Then the uninstall completes successfully", async () => {
      // Symmetric to install: the action re-lists the installed apps and only
      // completes once the device context no longer reports Bitcoin; otherwise it
      // keeps looping. The mock removes the app when the install endpoint runs for
      // an already-installed app, so the confirmation terminates.
      const response = await deviceActions.lastResponse<InstallAppResponse>({
        until: '"completed"',
        timeout: 60_000,
      });
      expect(response.status).toBe("completed");
    });
  });
});
