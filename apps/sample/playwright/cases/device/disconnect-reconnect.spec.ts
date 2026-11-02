import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  masks: [0x33000000],
};

interface GetOsVersionResponse {
  status: string;
  data?: { seVersion: string };
}

test.describe("device: disconnect and reconnect", () => {
  test("connects again after a disconnection and exchanges APDUs", async ({
    device,
    sidebar,
    commands,
  }) => {
    await test.step("Given a connected Nano X", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the device is disconnected", async () => {
      await sidebar.disconnect();
    });

    await test.step("Then its session is removed", async () => {
      await sidebar.expectNoSession();
    });

    await test.step("When the device is connected again", async () => {
      await device.connectOnCurrentPage();
    });

    await test.step("Then the Get OS version command succeeds", async () => {
      await commands.goto();
      await commands.execute("Get OS version");
      const response = await commands.lastResponse<GetOsVersionResponse>();
      expect(response.status).toBe("SUCCESS");
      expect(response.data?.seVersion).toBe("2.2.3");
    });
  });

  test("reconnects the session and exchanges APDUs", async ({
    device,
    sidebar,
    commands,
  }) => {
    await test.step("Given a connected Nano X", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the session is reconnected", async () => {
      await sidebar.reconnect();
    });

    await test.step("Then a new session replaces the old one", async () => {
      await sidebar.expectSessionCount(1);
      await sidebar.expectStatus("CONNECTED");
    });

    await test.step("And the Get OS version command succeeds", async () => {
      await commands.goto();
      await commands.execute("Get OS version");
      const response = await commands.lastResponse<GetOsVersionResponse>();
      expect(response.status).toBe("SUCCESS");
      expect(response.data?.seVersion).toBe("2.2.3");
    });
  });
});
