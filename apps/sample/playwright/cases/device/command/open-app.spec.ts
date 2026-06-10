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

const RESPONSE_ITEMS = '[data-testid="box_device-commands-responses"] > *';

interface OpenAppScenario {
  title: string;
  device: DeviceConfig;
  appName: string;
  expectError: boolean;
  expectedError?: {
    _tag: string;
    errorCode: string;
    message: string;
  };
}

// An installed app is opened by spinning up a real Speculos instance via the
// mock server's Speculinho proxy. Requesting an app that is not installed on the
// device fails immediately with "unknown application name" (no Speculos needed).
const SCENARIOS: OpenAppScenario[] = [
  {
    title: "opens an installed app on nanoX",
    device: {
      name: "Ledger Nano X",
      device_type: "nanoX",
      connectivity_type: "USB",
      firmware_version: "2.7.1",
      apps: [
        { name: "BOLOS", version: "2.7.1" },
        { name: "Bitcoin", version: "2.4.6" },
      ],
      masks: [0x33000000],
    },
    appName: "Bitcoin",
    expectError: false,
  },
  {
    title: "opens an installed app on stax",
    device: {
      name: "Ledger Stax",
      device_type: "stax",
      connectivity_type: "USB",
      firmware_version: "1.9.1",
      apps: [
        { name: "BOLOS", version: "1.9.1" },
        { name: "Ethereum", version: "1.22.0" },
      ],
      masks: [0x33200000],
    },
    appName: "Ethereum",
    expectError: false,
  },
  {
    title: "fails to open an app that is not installed on flex",
    device: {
      name: "Ledger Flex",
      device_type: "flex",
      connectivity_type: "USB",
      firmware_version: "1.3.0",
      apps: [{ name: "BOLOS", version: "1.3.0" }],
      masks: [0x33300000],
    },
    appName: "Solana",
    expectError: true,
    expectedError: {
      _tag: "OpenAppCommandError",
      errorCode: "6807",
      message: "Unknown application name",
    },
  },
];

interface OpenAppCommandError {
  _tag: string;
  errorCode: string;
  message: string;
}

interface OpenAppResponse {
  status: string;
  data?: unknown;
  error?: OpenAppCommandError;
  pending?: object;
}

test.describe("device command: open app", () => {
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

      test(scenario.title, async ({ page }) => {
        // Opening an installed app provisions a real Speculos instance, which can
        // take a while to become ready.
        test.setTimeout(120_000);

        await test.step("Given the device is connected", async () => {
          await page.getByTestId("CTA_select-device-MOCKSERVER").click();

          await expect(
            page.getByTestId("text_device-connection-status").first(),
          ).toContainText("CONNECTED");
        });

        await test.step(`When the Open app command is executed for "${scenario.appName}"`, async () => {
          await whenNavigateTo(page, "/commands");

          await whenExecuteDeviceCommand(page, "Open app", {
            inputField: "input-text_appName",
            inputValue: scenario.appName,
          });
        });

        await test.step("Then the expected result is returned", async () => {
          // Wait for the command to resolve: the rendered JSON contains "status"
          // only once the (possibly slow, Speculos-backed) response is settled.
          await expect(page.locator(RESPONSE_ITEMS).last()).toContainText(
            '"status"',
            { timeout: 90_000 },
          );

          const response = (await getLastDeviceResponseContent(
            page,
            "span",
          )) as OpenAppResponse;

          expect(response.status).toBe(
            scenario.expectError ? "ERROR" : "SUCCESS",
          );

          if (scenario.expectedError) {
            expect(response.error).toEqual(scenario.expectedError);
          }
        });
      });
    });
  }
});
