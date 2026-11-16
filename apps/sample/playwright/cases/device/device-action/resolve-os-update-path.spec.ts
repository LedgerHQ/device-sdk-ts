import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action waits for the app and version through device-session polling, so
// keep the refresher on.
test.use({ disablePolling: false });

// The update path is resolved from the live Manager API, so the device must run
// a real firmware.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

interface OsUpdate {
  finalFirmware: { version: string };
}

test.describe("device action: resolve OS update path", () => {
  test("resolves an update path from an outdated firmware", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Nano X on firmware 2.2.3", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Resolve OS update path device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Resolve OS update path");
    });

    // Only the first hop is asserted: the last one follows each new release.
    await test.step("Then the path goes through firmware 2.6.0 first", async () => {
      const result = await deviceActions.lastResult<OsUpdate[]>();
      expect(result.status).toBe("completed");
      expect(result.output?.[0]?.finalFirmware.version).toBe("2.6.0");
    });
  });
});
