/* eslint-disable no-restricted-imports */
import {
  type DeviceConfig,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { expect, test } from "@playwright/test";

import { setupMockServerSession } from "../../../utils/setup";
import { getLastDeviceResponseContent } from "../../../utils/utils";
import {
  whenExecuteDeviceCommand,
  whenNavigateTo,
} from "../../../utils/whenHandlers";

// GetAppAndVersion (b0 01 00 00) -> BOLOS dashboard, used by the connection
// handshake DMK runs when connecting the device.
const GET_APP_AND_VERSION_PREFIX = "b0010000";
// GetOsVersion (e0 01 00 00).
const GET_OS_VERSION_PREFIX = "e0010000";

const bolosResponse = (version: string): string => {
  const versionHex = Buffer.from(version, "ascii").toString("hex");
  const versionLen = (version.length & 0xff).toString(16).padStart(2, "0");
  // format(01) | len "BOLOS" "BOLOS" | len version version | 9000
  return `0105424f4c4f53${versionLen}${versionHex}9000`;
};

interface DeviceScenario {
  device: DeviceConfig;
  appVersion: string;
  getOsVersionResponse: string;
  expectedSeVersion: string;
  expectedTargetId: number;
}

const NANO_X: DeviceScenario = {
  device: {
    name: "Ledger Nano X",
    device_type: "nanoX",
    connectivity_type: "USB",
    firmware_version: "2.2.3",
    apps: [{ name: "BOLOS", version: "1.5.0" }],
    masks: [0x33000000],
  },
  appVersion: "1.5.0",
  getOsVersionResponse:
    "3300000405322e322e3304e600000004322e333004312e31360100010001009000",
  expectedSeVersion: "2.2.3",
  expectedTargetId: 855638020,
};

interface GetOsVersionResponse {
  status: string;
  data?: {
    seVersion: string;
    targetId: number;
  };
  error?: object;
  pending?: object;
}

test.describe("device command: get OS version", () => {
  const scenario = NANO_X;
  let client: MockClient;

  test.beforeEach(async ({ page }) => {
    client = await setupMockServerSession(page);

    await client.addDevice(scenario.device);
    await client.addMock({
      prefix: GET_APP_AND_VERSION_PREFIX,
      response: bolosResponse(scenario.appVersion),
    });
    await client.addMock({
      prefix: GET_OS_VERSION_PREFIX,
      response: scenario.getOsVersionResponse,
    });

    await page.goto("http://localhost:3000/");
  });

  test.afterEach(async () => {
    await client.disposeSession();
  });

  test(`device should get OS version on ${scenario.device.device_type}`, async ({
    page,
  }) => {
    await test.step("Given the device is connected", async () => {
      await page.getByTestId("CTA_select-device-MOCKSERVER").click();

      await expect(
        page.getByTestId("text_device-connection-status").first(),
      ).toContainText("CONNECTED");
    });

    await test.step("When the Get OS version command is executed", async () => {
      await whenNavigateTo(page, "/commands");

      await whenExecuteDeviceCommand(page, "Get OS version");
    });

    await test.step("Then the mocked firmware version is returned", async () => {
      const response = (await getLastDeviceResponseContent(
        page,
        "span",
      )) as GetOsVersionResponse;

      expect(response.status).toBe("SUCCESS");
      expect(response?.data?.seVersion).toBe(scenario.expectedSeVersion);
      expect(response?.data?.targetId).toBe(scenario.expectedTargetId);
    });
  });
});
