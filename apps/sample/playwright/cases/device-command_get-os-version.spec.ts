/* eslint-disable no-restricted-imports */
import {
  type DeviceConfig,
  MockClient,
} from "@ledgerhq/device-mockserver-client";
import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";

import { getLastDeviceResponseContent } from "../utils/utils";
import {
  whenExecuteDeviceCommand,
  whenNavigateTo,
} from "../utils/whenHandlers";

// The device mock server must be running on http://127.0.0.1:8080
// (start it manually: `pnpm --filter @ledgerhq/device-mock-server serve`).
// start-servers.sh creates one session up front and shares its bearer token with
// the sample app via NEXT_PUBLIC_MOCK_SERVER_SESSION_TOKEN; we read that same
// token here so the spec and the app operate on the same session.
const MOCK_SERVER_URL = "http://127.0.0.1:8080";
const TOKEN_FILE = path.resolve(__dirname, "../.mock-session-token");

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

const STAX: DeviceScenario = {
  device: {
    name: "Ledger Stax",
    device_type: "stax",
    connectivity_type: "USB",
    firmware_version: "1.3.0",
    apps: [{ name: "BOLOS", version: "1.6.0" }],
    masks: [0x33200000],
  },
  appVersion: "1.6.0",
  getOsVersionResponse:
    "3320000405312e332e3004e600000004352e323404302e3438010001009000",
  expectedSeVersion: "1.3.0",
  expectedTargetId: 857735172,
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

/**
 * Reset the shared mock server session to a single device with the canned
 * handshake (GetAppAndVersion) and GetOsVersion responses for a scenario, so the
 * sample app discovers and connects exactly that device.
 */
async function configureSession(
  client: MockClient,
  scenario: DeviceScenario,
): Promise<void> {
  await client.clearMocks();
  const devices = await client.listDevices();
  await Promise.all(devices.map((device) => client.deleteDevice(device.id)));

  await client.addDevice(scenario.device);
  await client.addMock({
    prefix: GET_APP_AND_VERSION_PREFIX,
    response: bolosResponse(scenario.appVersion),
  });
  await client.addMock({
    prefix: GET_OS_VERSION_PREFIX,
    response: scenario.getOsVersionResponse,
  });
}

test.describe("device command: get OS version", () => {
  let client: MockClient;

  test.beforeAll(() => {
    const token = readFileSync(TOKEN_FILE, "utf-8").trim();
    client = new MockClient(MOCK_SERVER_URL, { token });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  for (const scenario of [NANO_X, STAX]) {
    test(`device should get OS version on ${scenario.device.device_type}`, async ({
      page,
    }) => {
      await test.step("Given the mock session is configured", async () => {
        await configureSession(client, scenario);
      });

      await test.step("And the device is connected", async () => {
        await page.getByTestId("CTA_select-device-MOCKSERVER").click();

        await expect(
          page.getByTestId("text_device-connection-status").first(),
        ).toContainText("CONNECTED");
      });

      await test.step("Then get OS version returns the mocked firmware", async () => {
        await whenNavigateTo(page, "/commands");

        await whenExecuteDeviceCommand(page, "Get OS version");

        const response = (await getLastDeviceResponseContent(
          page,
          "span",
        )) as GetOsVersionResponse;

        expect(response.status).toBe("SUCCESS");
        expect(response?.data?.seVersion).toBe(scenario.expectedSeVersion);
        expect(response?.data?.targetId).toBe(scenario.expectedTargetId);
      });
    });
  }
});
