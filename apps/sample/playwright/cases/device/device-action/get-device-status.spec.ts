import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action waits for the app and version through device-session polling, so
// keep the refresher on.
test.use({ disablePolling: false });

const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [{ name: "BOLOS", version: "1.9.1" }],
  masks: [0x33200000],
};

const GET_APP_AND_VERSION_PREFIX = "b0010000";
const LOCKED_RESPONSE = "5515";

interface GetDeviceStatusOutput {
  currentApp: string;
  currentAppVersion: string;
}

test.describe("device action: get device status", () => {
  test("returns BOLOS and the firmware version at the dashboard", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Stax with firmware 1.9.1 at the dashboard", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Get device status device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Get device status");
    });

    await test.step("Then it returns BOLOS 1.9.1", async () => {
      const result = await deviceActions.lastResult<GetDeviceStatusOutput>();
      expect(result.status).toBe("completed");
      expect(result.output).toEqual({
        currentApp: "BOLOS",
        currentAppVersion: "1.9.1",
      });
    });
  });

  test("asks to unlock the device, then returns the status once unlocked", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let devId = "";
    let lockMockId = "";

    await test.step("Given a locked Stax at the dashboard", async () => {
      const dev = await device.addAndConnect(STAX);
      devId = dev.id;
      const mock = await mockClient.addMock(devId, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      lockMockId = mock.id;
    });

    await test.step("When the Get device status device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Get device status");
    });

    await test.step("Then user interaction unlock-device is required", async () => {
      await deviceActions.expectRequiredUserInteraction("unlock-device");
    });

    await test.step("When the device is unlocked", async () => {
      await mockClient.deleteMock(devId, lockMockId);
    });

    await test.step("Then it returns BOLOS 1.9.1", async () => {
      const result = await deviceActions.lastResult<GetDeviceStatusOutput>();
      expect(result.status).toBe("completed");
      expect(result.output?.currentApp).toBe("BOLOS");
    });
  });
});
