/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";
import { type CommandsDriver } from "../../../utils/drivers/CommandsDriver";

// GetOsVersion (e0 01 00 00).
const GET_OS_VERSION_PREFIX = "e0010000";

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

const OK_RESPONSE =
  "3300000405322e322e3304e600000004322e333004312e31360100010001009000";
// Locked device status word: any non-9000 status makes GetOsVersion fail.
const ERROR_RESPONSE = "5515";
const EXPECTED_SE_VERSION = "2.2.3";

interface GetOsVersionResponse {
  status: string;
  data?: {
    seVersion: string;
    targetId: number;
  };
  error?: object;
  pending?: object;
}

/** Click Send once and read the freshly appended (resolved) response. */
async function executeGetOsVersion(
  commands: CommandsDriver,
  expectedCount: number,
): Promise<GetOsVersionResponse> {
  await commands.send();
  await commands.waitForResponseCount(expectedCount);
  return commands.lastResponse<GetOsVersionResponse>();
}

test.describe("device command: get OS version error sequence", () => {
  test("device should fail to get OS version only on the third execution", async ({
    mockClient,
    device,
    commands,
  }) => {
    await test.step("Given the device is connected with a sequenced OS version mock", async () => {
      const added = await device.add(NANO_X);
      // The connection handshake only issues GetAppAndVersion, so each Send of
      // the GetOsVersion command consumes one entry of this sequence in order,
      // looping back to the start once exhausted.
      await mockClient.addMock(added.id, {
        prefix: GET_OS_VERSION_PREFIX,
        responses: [OK_RESPONSE, OK_RESPONSE, ERROR_RESPONSE],
      });
      await device.connect();
    });

    await test.step("When the Get OS version command is executed four times", async () => {
      await commands.goto();
      // Open the command drawer; subsequent executions just click Send again.
      await commands.open("Get OS version");
    });

    await test.step("Then the first two executions succeed", async () => {
      const first = await executeGetOsVersion(commands, 1);
      expect(first.status).toBe("SUCCESS");
      expect(first.data?.seVersion).toBe(EXPECTED_SE_VERSION);

      const second = await executeGetOsVersion(commands, 2);
      expect(second.status).toBe("SUCCESS");
      expect(second.data?.seVersion).toBe(EXPECTED_SE_VERSION);
    });

    await test.step("And the third execution fails", async () => {
      const third = await executeGetOsVersion(commands, 3);
      expect(third.status).toBe("ERROR");
      expect(third.data).toBeUndefined();
    });

    await test.step("And the sequence loops back to success on the fourth", async () => {
      const fourth = await executeGetOsVersion(commands, 4);
      expect(fourth.status).toBe("SUCCESS");
      expect(fourth.data?.seVersion).toBe(EXPECTED_SE_VERSION);
    });
  });
});
