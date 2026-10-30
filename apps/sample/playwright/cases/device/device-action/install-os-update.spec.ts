import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The actions check the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

// The update is resolved from the live Manager API, then installed through the
// mock server's secure channel, so the device must run a real firmware.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};

test.describe("device action: install OS update", () => {
  test("installs the first update of the resolved path", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    test.setTimeout(120_000);

    let devId = "";
    let osUpdate: { finalFirmware: { version: string } } | undefined;

    await test.step("Given a Nano X on firmware 2.2.3 and its resolved update path", async () => {
      devId = (await device.addAndConnect(NANO_X)).id;
      await deviceActions.goto();
      await deviceActions.execute("Resolve OS update path");
      const resolved =
        await deviceActions.lastResult<
          { finalFirmware: { version: string } }[]
        >();
      expect(resolved.status).toBe("completed");
      osUpdate = resolved.output?.[0];
    });

    await test.step("When the Install OS Update device action is executed for the first update", async () => {
      await deviceActions.backToList();
      await deviceActions.installOsUpdate(osUpdate);
    });

    await test.step("Then the user is asked to allow the firmware install", async () => {
      await deviceActions.expectAnyResponseContains(
        '"requiredUserInteraction": "allow-install-firmware"',
      );
    });

    await test.step("And the install completes", async () => {
      await deviceActions.expectAnyResponseContains('"progress": 1');
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("And the device runs the new firmware", async () => {
      expect((await mockClient.getDevice(devId)).firmware_version).toBe(
        osUpdate?.finalFirmware.version,
      );
    });
  });
});
