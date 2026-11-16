import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action checks the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

// Opening an installed app provisions a real Speculos instance through the mock
// server's Speculinho proxy. An app that is not installed is rejected by the
// mock before any Speculos is needed.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.7.1",
  apps: [
    { name: "BOLOS", version: "2.7.1" },
    { name: "Bitcoin", version: "2.4.6" },
  ],
  masks: [0x33000000],
};

const GET_APP_AND_VERSION_PREFIX = "b0010000";
const OPEN_APP_PREFIX = "e0d80000";
const LOCKED_RESPONSE = "5515";
const REFUSED_RESPONSE = "5501";

interface GetAppAndVersionResponse {
  status: string;
  data?: { name: string; version: string };
}

test.describe("device action: open app", () => {
  test("opens an installed app from the dashboard", async ({
    device,
    deviceActions,
    commands,
  }) => {
    test.setTimeout(120_000);

    await test.step("Given a Nano X at the dashboard with Bitcoin installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Open app device action is executed for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.openApp("Bitcoin");
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("And Bitcoin is the running app", async () => {
      await commands.goto();
      await commands.execute("Get app and version");
      const response = await commands.lastResponse<GetAppAndVersionResponse>();
      expect(response.data?.name).toBe("Bitcoin");
    });
  });

  test("fails when the app is not installed", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Nano X at the dashboard without Solana installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the Open app device action is executed for Solana", async () => {
      await deviceActions.goto();
      await deviceActions.openApp("Solana");
    });

    await test.step("Then it fails with the unknown application error", async () => {
      const error = await deviceActions.expectError("OpenAppCommandError");
      expect(error).toContain("6807");
    });
  });

  test("fails when the user refuses to open the app", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    await test.step("Given a Nano X whose user refuses the open app prompt", async () => {
      const dev = await device.addAndConnect(NANO_X);
      await mockClient.addMock(dev.id, {
        prefix: OPEN_APP_PREFIX,
        response: REFUSED_RESPONSE,
      });
    });

    await test.step("When the Open app device action is executed for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.openApp("Bitcoin");
    });

    await test.step("Then it fails with ActionRefusedError", async () => {
      const error = await deviceActions.expectError("ActionRefusedError");
      expect(error).toContain(REFUSED_RESPONSE);
    });
  });

  test("asks to unlock the device, then opens the app once unlocked", async ({
    device,
    deviceActions,
    mockClient,
    commands,
  }) => {
    test.setTimeout(120_000);
    let devId = "";
    let lockMockId = "";

    await test.step("Given a locked Nano X with Bitcoin installed", async () => {
      const dev = await device.addAndConnect(NANO_X);
      devId = dev.id;
      const mock = await mockClient.addMock(devId, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      lockMockId = mock.id;
    });

    await test.step("When the Open app device action is executed for Bitcoin", async () => {
      await deviceActions.goto();
      await deviceActions.openApp("Bitcoin");
    });

    await test.step("Then user interaction unlock-device is required", async () => {
      await deviceActions.expectRequiredUserInteraction("unlock-device");
    });

    await test.step("When the device is unlocked", async () => {
      await mockClient.deleteMock(devId, lockMockId);
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("And Bitcoin is the running app", async () => {
      await commands.goto();
      await commands.execute("Get app and version");
      const response = await commands.lastResponse<GetAppAndVersionResponse>();
      expect(response.data?.name).toBe("Bitcoin");
    });
  });
});
