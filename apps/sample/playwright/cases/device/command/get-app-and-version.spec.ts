/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

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
      test(`device should get app and version on ${scenario.device.device_type}`, async ({
        device,
        commands,
      }) => {
        await test.step("Given the device is connected", async () => {
          await device.addAndConnect(scenario.device);
        });

        await test.step("When the Get app and version command is executed", async () => {
          await commands.goto();
          await commands.execute("Get app and version");
        });

        await test.step("Then the dashboard app and version are returned", async () => {
          const response =
            await commands.lastResponse<GetAppAndVersionResponse>();

          expect(response.status).toBe("SUCCESS");
          expect(response?.data?.name).toBe(scenario.expectedName);
          expect(response?.data?.version).toBe(scenario.expectedVersion);
        });
      });
    });
  }
});
