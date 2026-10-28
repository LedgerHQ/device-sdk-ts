import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// A device action reports what the user must do through the
// requiredUserInteraction of each pending state. These tests pin the order of
// those prompts, which breaks when a state machine is reordered.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.7.1",
  apps: [
    { name: "BOLOS", version: "2.7.1" },
    { name: "Bitcoin", version: "2.4.6" },
  ],
  masks: [0x33000000],
};

test.describe("device: user interaction sequence", () => {
  test("Genuine Check asks to allow the secure connection once", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a connected Nano X", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Genuine Check device action completes", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Genuine Check");
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("Then the prompts are none, allow-secure-connection, none", async () => {
      expect(await deviceActions.userInteractionSequence()).toEqual([
        "none",
        "allow-secure-connection",
        "none",
      ]);
    });
  });

  test("Open app asks to confirm the opening once", async ({
    device,
    deviceActions,
  }) => {
    // Opening Bitcoin provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given a Nano X at the dashboard with Bitcoin installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Open app device action completes for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.openApp("Bitcoin");
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("Then the prompts are none, confirm-open-app, none", async () => {
      expect(await deviceActions.userInteractionSequence()).toEqual([
        "none",
        "confirm-open-app",
        "none",
      ]);
    });
  });
});
