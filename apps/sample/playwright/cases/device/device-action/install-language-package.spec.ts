import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// The action checks the device status through device-session polling, so keep
// the refresher on.
test.use({ disablePolling: false });

// The language packages are fetched from the live Manager API, so the device
// must run a real firmware.
const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [{ name: "BOLOS", version: "1.9.1" }],
  masks: [0x33200000],
};

// Language load: create (0x30), then chunks (0x31) and commit (0x32).
const LANGUAGE_LOAD_CREATE_PREFIX = "e030";

test.describe("device action: install language package", () => {
  test("installs the French language package", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    test.setTimeout(120_000);
    let devId = "";

    await test.step("Given a Stax in English", async () => {
      devId = (await device.addAndConnect(STAX)).id;
    });

    await test.step("When the Install language package device action is executed for French", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Install language package");
    });

    await test.step("Then it completes", async () => {
      const result = await deviceActions.lastResult();
      expect(result.status).toBe("completed");
    });

    await test.step("And the device language is French", async () => {
      expect((await mockClient.getDevice(devId)).language).toBe("french");
    });
  });

  test("fails when the user refuses the language package", async ({
    device,
    deviceActions,
    mockClient,
  }) => {
    test.setTimeout(120_000);

    await test.step("Given a Stax whose user refuses the language package", async () => {
      const dev = await device.addAndConnect(STAX);
      await mockClient.addMock(dev.id, {
        prefix: LANGUAGE_LOAD_CREATE_PREFIX,
        response: "5501",
      });
    });

    await test.step("When the Install language package device action is executed for French", async () => {
      await deviceActions.goto();
      await deviceActions.execute("Install language package");
    });

    await test.step("Then it fails with RefusedByUserDAError", async () => {
      await deviceActions.expectError("RefusedByUserDAError", {
        timeout: 60_000,
      });
    });
  });
});
