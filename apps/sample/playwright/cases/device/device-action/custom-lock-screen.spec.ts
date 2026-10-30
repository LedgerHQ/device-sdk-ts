import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The actions check the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

// The mock models a Stax with no lock screen image loaded: reads report it
// empty and writes are not stored, so an upload can never read its hash back.
const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [{ name: "BOLOS", version: "1.9.1" }],
  masks: [0x33200000],
};

const CLS_CREATE_PREFIX = "e060";

test.describe("device action: custom lock screen", () => {
  test("reports no custom lock screen on an empty device", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Stax without a custom lock screen", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Get Custom Lock Screen Info device action is executed", async () => {
      await deviceActions.gotoLedgerWallet();
      await deviceActions.execute("Get Custom Lock Screen Info");
    });

    await test.step("Then it reports no custom lock screen", async () => {
      const result = await deviceActions.lastResult<{
        hasCustomLockScreen: boolean;
      }>();
      expect(result.status).toBe("completed");
      expect(result.output).toEqual({ hasCustomLockScreen: false });
    });
  });

  test("fails when the user refuses the custom lock screen", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    await test.step("Given a Stax whose user refuses the custom lock screen", async () => {
      const dev = await device.addAndConnect(STAX);
      await mockClient.addMock(dev.id, {
        prefix: CLS_CREATE_PREFIX,
        response: "5501",
      });
    });

    await test.step("When the Upload Custom Lock Screen (Hex) device action is executed", async () => {
      await deviceActions.gotoLedgerWallet();
      await deviceActions.uploadCustomLockScreen("00".repeat(64));
    });

    await test.step("Then it fails with RefusedByUserDAError", async () => {
      const error = await deviceActions.expectError("RefusedByUserDAError");
      expect(error).toContain("User refused on device");
    });
  });

  test("fails to remove a custom lock screen that does not exist", async ({
    device,
    deviceActions,
  }) => {
    await test.step("Given a Stax without a custom lock screen", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Remove Custom Lock Screen device action is executed", async () => {
      await deviceActions.gotoLedgerWallet();
      await deviceActions.execute("Remove Custom Lock Screen");
    });

    await test.step("Then it fails with NoCustomLockScreenImageDAError", async () => {
      await deviceActions.expectError("NoCustomLockScreenImageDAError");
    });
  });
});
