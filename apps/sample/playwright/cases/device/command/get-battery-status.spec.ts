import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// GetBatteryStatus responses are derived by the mock server for battery-capable
// touch devices (Stax, Flex, Apex). Models without a battery fall through to
// UNKNOWN_APDU_RESPONSE (6d00).
const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [{ name: "BOLOS", version: "1.9.1" }],
  masks: [0x33200000],
};

const NANO_S: DeviceConfig = {
  name: "Ledger Nano S",
  device_type: "nanoS",
  connectivity_type: "USB",
  firmware_version: "2.1.0",
  apps: [{ name: "BOLOS", version: "2.1.0" }],
  masks: [0x31100000],
};

interface GetBatteryStatusResponse {
  status: string;
  data?: number;
  error?: object;
}

test.describe("device command: get battery status", () => {
  /**
   * GIVEN a Stax device with firmware 1.9.1 at the dashboard
   * WHEN the Get battery status command is executed with the status type BATTERY_PERCENTAGE
   * THEN the battery status is returned with status SUCCESS
   * AND the battery level is 100%
   */
  test("returns 100% on Stax with BATTERY_PERCENTAGE", async ({
    device,
    commands,
  }) => {
    await test.step("Given a Stax device with firmware 1.9.1 at the dashboard", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Get battery status command is executed with the status type BATTERY_PERCENTAGE", async () => {
      await commands.goto();
      await commands.execute("Get battery status", {
        selectOption: "BATTERY_PERCENTAGE",
      });
    });

    await test.step("Then the battery status is returned with status SUCCESS", async () => {
      const response = await commands.lastResponse<GetBatteryStatusResponse>();

      expect(response.status).toBe("SUCCESS");
    });

    await test.step("And the battery level is 100%", async () => {
      const response = await commands.lastResponse<GetBatteryStatusResponse>();

      expect(response.data).toBe(100);
    });
  });

  /**
   * GIVEN a Nano S device at the dashboard
   * WHEN the Get battery status command is executed with the status type BATTERY_PERCENTAGE
   * THEN the battery status is returned with status ERROR
   */
  test("returns ERROR on Nano S with BATTERY_PERCENTAGE", async ({
    device,
    commands,
  }) => {
    await test.step("Given a Nano S device at the dashboard", async () => {
      await device.addAndConnect(NANO_S);
    });

    await test.step("When the Get battery status command is executed with the status type BATTERY_PERCENTAGE", async () => {
      await commands.goto();
      await commands.execute("Get battery status", {
        selectOption: "BATTERY_PERCENTAGE",
      });
    });

    await test.step("Then the battery status is returned with status ERROR", async () => {
      const response = await commands.lastResponse<GetBatteryStatusResponse>();

      expect(response.status).toBe("ERROR");
    });
  });
});
