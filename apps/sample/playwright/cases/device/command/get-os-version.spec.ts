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

interface DeviceScenario {
  device: DeviceConfig;
  expectedSeVersion: string;
  expectedTargetId: number;
}

// GetOsVersion responses are derived by the mock server from the device model
// and firmware version, so no explicit mock needs to be seeded.
const SCENARIOS: DeviceScenario[] = [
  {
    device: {
      name: "Ledger Nano X",
      device_type: "nanoX",
      connectivity_type: "USB",
      firmware_version: "2.2.3",
      apps: [{ name: "BOLOS", version: "1.5.0" }],
      masks: [0x33000000],
    },
    expectedSeVersion: "2.2.3",
    expectedTargetId: 855638020,
  },
  {
    device: {
      name: "Ledger Stax",
      device_type: "stax",
      connectivity_type: "USB",
      firmware_version: "1.3.0",
      apps: [{ name: "BOLOS", version: "1.6.0" }],
      masks: [0x33200000],
    },
    expectedSeVersion: "1.3.0",
    expectedTargetId: 857735172,
  },
];

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
  for (const scenario of SCENARIOS) {
    test.describe(scenario.device.device_type, () => {
      let client: MockClient;

      test.beforeEach(async ({ page }) => {
        client = await setupMockServerSession(page);

        await client.addDevice(scenario.device);

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
  }
});
