import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  masks: [0x33000000],
};

const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  masks: [0x33200000],
};

interface GetOsVersionResponse {
  status: string;
  data?: { seVersion: string };
}

test.describe("device: several sessions", () => {
  test("each session talks to its own device", async ({
    device,
    sidebar,
    commands,
  }) => {
    await test.step("Given a Nano X and a Stax connected at the same time", async () => {
      // Connecting the mock transport opens a session for every attached device.
      await device.add(NANO_X);
      await device.add(STAX);
      await device.connect();
    });

    await test.step("When Get OS version is executed on the Nano X session", async () => {
      await sidebar.selectSession("Ledger Nano X");
      await commands.goto();
      await commands.execute("Get OS version");
    });

    await test.step("Then the Nano X firmware is returned", async () => {
      const response = await commands.lastResponse<GetOsVersionResponse>();
      expect(response.status).toBe("SUCCESS");
      expect(response.data?.seVersion).toBe("2.2.3");
    });

    await test.step("When Get OS version is executed on the Stax session", async () => {
      await commands.closeDrawer();
      await sidebar.selectSession("Ledger Stax");
      await commands.goto();
      await commands.execute("Get OS version");
    });

    await test.step("Then the Stax firmware is returned", async () => {
      const response = await commands.lastResponse<GetOsVersionResponse>();
      expect(response.status).toBe("SUCCESS");
      expect(response.data?.seVersion).toBe("1.9.1");
    });
  });
});
