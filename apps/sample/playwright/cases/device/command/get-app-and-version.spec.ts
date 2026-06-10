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
  expectedName: string;
  expectedVersion: string;
}

// At the dashboard (no app opened) the derived GetAppAndVersion response reports
// the running "app" as BOLOS with the device firmware version.
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
    expectedName: "BOLOS",
    expectedVersion: "2.2.3",
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
    expectedName: "BOLOS",
    expectedVersion: "1.3.0",
  },
];

interface GetAppAndVersionResponse {
  status: string;
  data?: {
    name: string;
    version: string;
  };
  error?: object;
  pending?: object;
}

test.describe("device command: get app and version", () => {
  for (const scenario of SCENARIOS) {
    test.describe(scenario.device.device_type!, () => {
      let client: MockClient;

      test.beforeEach(async ({ page }) => {
        client = await setupMockServerSession(page);

        await client.addDevice(scenario.device);

        await page.goto("http://localhost:3000/");
      });

      test.afterEach(async () => {
        await client.disposeSession();
      });

      test(`device should get app and version on ${scenario.device.device_type}`, async ({
        page,
      }) => {
        await test.step("Given the device is connected", async () => {
          await page.getByTestId("CTA_select-device-MOCKSERVER").click();

          await expect(
            page.getByTestId("text_device-connection-status").first(),
          ).toContainText("CONNECTED");
        });

        await test.step("When the Get app and version command is executed", async () => {
          await whenNavigateTo(page, "/commands");

          await whenExecuteDeviceCommand(page, "Get app and version");
        });

        await test.step("Then the dashboard app and version are returned", async () => {
          const response = (await getLastDeviceResponseContent(
            page,
            "span",
          )) as GetAppAndVersionResponse;

          expect(response.status).toBe("SUCCESS");
          expect(response?.data?.name).toBe(scenario.expectedName);
          expect(response?.data?.version).toBe(scenario.expectedVersion);
        });
      });
    });
  }
});
