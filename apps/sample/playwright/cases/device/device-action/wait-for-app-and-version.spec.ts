import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [{ name: "BOLOS", version: "1.9.1" }],
  masks: [0x33200000],
};

// GetAppAndVersion APDU polled by the device-session refresher and by the action.
const GET_APP_AND_VERSION_PREFIX = "b0010000";
// "Device is locked" status word.
const LOCKED_RESPONSE = "5515";

interface WaitForAppAndVersionOutput {
  name: string;
  version: string;
}

test.describe("device action: wait for app and version", () => {
  /**
   * GIVEN a Stax device with firmware 1.9.1 at the dashboard
   * WHEN the Wait for app and version device action is executed
   * THEN the app and version are returned with status SUCCESS
   * AND the app name is "BOLOS"
   * AND the app version is "1.9.1"
   */
  test("returns BOLOS and firmware version at the dashboard", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Stax device with firmware 1.9.1 at the dashboard", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Wait for app and version device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.waitForAppAndVersion();
    });

    await test.step("Then the app and version are returned with status SUCCESS", async () => {
      const result =
        await deviceActions.lastResult<WaitForAppAndVersionOutput>();

      expect(result.status).toBe("completed");
    });

    await test.step('And the app name is "BOLOS"', async () => {
      const result =
        await deviceActions.lastResult<WaitForAppAndVersionOutput>();

      expect(result.output!.name).toBe("BOLOS");
    });

    await test.step('And the app version is "1.9.1"', async () => {
      const result =
        await deviceActions.lastResult<WaitForAppAndVersionOutput>();

      expect(result.output!.version).toBe("1.9.1");
    });
  });

  /**
   * GIVEN a Stax device with firmware 1.9.1 at the dashboard
   * WHEN the device is locked
   * AND the Wait for app and version device action is executed
   * THEN user interaction unlock-device is required
   * WHEN the device is unlocked
   * THEN the app and version are returned with status SUCCESS
   * AND the app name is "BOLOS"
   * AND the app version is "1.9.1"
   */
  test("succeeds after the device is unlocked", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    let lockMockId = "";

    await test.step("Given a Stax device with firmware 1.9.1 at the dashboard", async () => {
      dev = await device.addAndConnect(STAX);
    });

    await test.step("When the device is locked", async () => {
      const mock = await mockClient.addMock(dev.id, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      lockMockId = mock.id;
    });

    await test.step("And the Wait for app and version device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.waitForAppAndVersion();
    });

    await test.step("Then user interaction unlock-device is required", async () => {
      await deviceActions.expectRequiredUserInteraction("unlock-device");
    });

    await test.step("When the device is unlocked", async () => {
      await mockClient.deleteMock(dev.id, lockMockId);
    });

    await test.step("Then the app and version are returned with status SUCCESS", async () => {
      const result =
        await deviceActions.lastResult<WaitForAppAndVersionOutput>();

      expect(result.status).toBe("completed");
    });

    await test.step('And the app name is "BOLOS"', async () => {
      const result =
        await deviceActions.lastResult<WaitForAppAndVersionOutput>();

      expect(result.output!.name).toBe("BOLOS");
    });

    await test.step('And the app version is "1.9.1"', async () => {
      const result =
        await deviceActions.lastResult<WaitForAppAndVersionOutput>();

      expect(result.output!.version).toBe("1.9.1");
    });
  });
});
