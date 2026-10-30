import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action checks the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [
    { name: "BOLOS", version: "1.5.0" },
    { name: "Bitcoin", version: "2.1.0" },
    { name: "Ethereum", version: "1.10.3" },
  ],
  masks: [0x33000000],
};

interface AppResponse {
  appName: string;
}

test.describe("device action: list apps", () => {
  test("lists the apps installed on the device", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Nano X with Bitcoin and Ethereum installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the List apps device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("List apps");
    });

    await test.step("Then it returns Bitcoin and Ethereum", async () => {
      const result = await deviceActions.lastResult<AppResponse[]>();
      expect(result.status).toBe("completed");
      expect(result.output?.map((app) => app.appName)).toEqual([
        "Bitcoin",
        "Ethereum",
      ]);
    });
  });
});
