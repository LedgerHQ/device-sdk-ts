import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action checks the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

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

const GET_APP_AND_VERSION_PREFIX = "b0010000";
const LOCKED_RESPONSE = "5515";
const CLOSE_APP_PREFIX = "b0a7";

test.describe("device action: go to dashboard", () => {
  test("completes without closing anything when already at the dashboard", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    await test.step("Given a Nano X at the dashboard", async () => {
      const dev = await device.addAndConnect(NANO_X);
      // A Close App would fail, so completing proves none was sent.
      await mockClient.addMock(dev.id, {
        prefix: CLOSE_APP_PREFIX,
        response: "6985",
      });
    });

    await test.step("When the Go to dashboard device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Go to dashboard");
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });
  });

  test("closes the running app", async ({ device, deviceActions }) => {
    // Opening Bitcoin provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given a Nano X running Bitcoin", async () => {
      await device.addAndConnect(NANO_X);
      await deviceActions.goto();
      await deviceActions.openApp("Bitcoin");
      const opened = await deviceActions.lastResult();
      expect(opened.status).toBe("completed");
    });

    await test.step("When the Go to dashboard device action is executed", async () => {
      await deviceActions.backToList();
      await deviceActions.execute("Go to dashboard");
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });
  });

  test("asks to unlock the device, then completes once unlocked", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let devId = "";
    let lockMockId = "";

    await test.step("Given a locked Nano X", async () => {
      const dev = await device.addAndConnect(NANO_X);
      devId = dev.id;
      const mock = await mockClient.addMock(devId, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      lockMockId = mock.id;
    });

    await test.step("When the Go to dashboard device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Go to dashboard");
    });

    await test.step("Then user interaction unlock-device is required", async () => {
      await deviceActions.expectRequiredUserInteraction("unlock-device");
    });

    await test.step("When the device is unlocked", async () => {
      await mockClient.deleteMock(devId, lockMockId);
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });
  });
});
