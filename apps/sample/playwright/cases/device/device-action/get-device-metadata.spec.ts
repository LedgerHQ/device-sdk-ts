import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action checks the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

// The firmware metadata is fetched from the live Manager API, so the device must
// run a real firmware.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

interface GetDeviceMetadataOutput {
  firmwareVersion: { os: string };
  applications: unknown[];
}

test.describe("device action: get device metadata", () => {
  test("returns the firmware version and no apps on a fresh device", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Nano X on firmware 2.2.3 with no app installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Get device metadata device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Get device metadata");
    });

    await test.step("Then it returns firmware 2.2.3 and no applications", async () => {
      const result = await deviceActions.lastResult<GetDeviceMetadataOutput>();
      expect(result.status).toBe("completed");
      expect(result.output?.firmwareVersion.os).toBe("2.2.3");
      expect(result.output?.applications).toEqual([]);
    });
  });
});
