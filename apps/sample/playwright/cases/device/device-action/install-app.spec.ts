/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

// Install runs the secure-channel `install` flow (handshake + a bulk stream of
// install APDUs). The mock server derives the bulk APDUs (0xE0 0xF0) to success
// by default; an explicit mock overrides them to inject a device error. The app
// catalog is still fetched from the live Manager API, so this must be a real
// firmware + a real, not-yet-installed app.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

const APP_TO_INSTALL = "Bitcoin";

test.describe("device action: install app", () => {
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
