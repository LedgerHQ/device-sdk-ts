/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

// The mock server's secure-channel WebSocket plays the ScriptRunner role: it
// runs the handshake (resolved by the device APDU mocks, which derive to
// success) and reports the genuine result. The OS/firmware metadata is still
// fetched from the live Manager API, so this device must be a real firmware.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

interface GenuineCheckResponse {
  status: string;
  output?: { isGenuine: boolean };
}

test.describe("device action: genuine check", () => {
  test("reports a mock Nano X as genuine via the secure channel", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given the device is connected", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Genuine Check device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Genuine Check");
    });

    await test.step("Then the device is reported genuine", async () => {
      const response = await deviceActions.lastResponse<GenuineCheckResponse>({
        until: '"completed"',
      });
      expect(response.status).toBe("completed");
      expect(response.output?.isGenuine).toBe(true);
    });
  });

  test("reports a non-genuine device when the secure channel returns a non-0000 verdict", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected device whose secure channel reports a non-genuine verdict", async () => {
      dev = await device.addAndConnect(NANO_X);
      // Override the synthetic genuine-verdict APDU (0xE0 0xF1) so the device
      // reports a non-genuine result (data 0001 instead of 0000).
      await mockClient.addMock(dev.id, {
        prefix: "e0f1",
        response: "00019000",
      });
    });

    await test.step("When the Genuine Check device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Genuine Check");
    });

    await test.step("Then the device is reported as not genuine", async () => {
      const response = await deviceActions.lastResponse<GenuineCheckResponse>({
        until: '"completed"',
      });
      expect(response.status).toBe("completed");
      expect(response.output?.isGenuine).toBe(false);
    });
  });

  test("fails when the user refuses the secure connection on the device", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected device that declines the secure connection", async () => {
      dev = await device.addAndConnect(NANO_X);
      // Override the derived handshake so the permission APDU (0xE0 0x51) is
      // declined on the device, as if the user rejected the prompt (5501).
      await mockClient.addMock(dev.id, { prefix: "e051", response: "5501" });
    });

    await test.step("When the Genuine Check device action is executed", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Genuine Check");
    });

    await test.step("Then the genuine check fails with RefusedByUserDAError", async () => {
      const error = await deviceActions.expectError("RefusedByUserDAError");
      expect(error).not.toContain('"isGenuine": true');
    });
  });
});
