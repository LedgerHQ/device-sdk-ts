import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The actions check the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

interface ListInstalledAppsOutput {
  installedApps: { name: string }[];
}

test.describe("device action: clean device", () => {
  test("uninstalls every app", async ({ device, deviceActions }) => {
    test.setTimeout(120_000);

    // Apps declared in the device config carry a zero hash the Manager API
    // cannot uninstall. Installing Bitcoin stores its real hash.
    await test.step("Given a Nano X with Bitcoin installed", async () => {
      await device.addAndConnect(NANO_X);
      await deviceActions.goto();
      await deviceActions.installApp("Bitcoin");
      const installed = await deviceActions.lastResult();
      expect(installed.status).toBe("completed");
    });

    await test.step("When the Clean Device device action is executed", async () => {
      await deviceActions.backToList();
      await deviceActions.execute("Clean Device");
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("And no app is installed anymore", async () => {
      await deviceActions.backToList();
      await deviceActions.listInstalledApps();
      const result = await deviceActions.lastResult<ListInstalledAppsOutput>();
      expect(result.output?.installedApps).toEqual([]);
    });
  });
});
