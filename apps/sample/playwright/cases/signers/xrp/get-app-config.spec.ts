/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const NANO_X_WITH_XRP: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [
    { name: "BOLOS", version: "2.2.3" },
    { name: "XRP", version: "2.4.0" },
  ],
  masks: [0x33000000],
};

// GetAppConfig APDU: CLA e0, INS 06, P1 00, P2 00.
const GET_APP_CONFIG_PREFIX = "e0060000";

// The XRP app answers 4 bytes `[flags, major, minor, patch]` then `9000`. The
// flags byte is reserved and skipped by the command, so a non-zero value here
// also guards against it being mistaken for part of the version.
const APP_CONFIG_RESPONSE = "0f0204009000";
const EXPECTED_VERSION = "2.4.0";

// "Condition of use not satisfied (Rejected by user)".
const REJECTED_RESPONSE = "6985";

// Latest Stax combo carrying an XRP build in coin-apps
// (`stax/1.10.1/XRP/app_2.6.1.elf`). The declared version is what selects the
// ELF Speculinho boots, so it doubles as the version the app reports back.
// If the image ever drops this build, `/acquire` fails — fall back to
// stax/1.9.1 + XRP 2.5.2, the OS the Tron and Ethereum specs already use.
const XRP_APP_VERSION = "2.6.1";
const STAX_WITH_XRP: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.10.1",
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "XRP", version: XRP_APP_VERSION },
  ],
  masks: [0x33200000],
};

interface AppConfigOutput {
  version: string;
}

test.describe("signer xrp: get app config", () => {
  // The two tests below never open the XRP app (`skipOpenApp`), so no Speculos
  // instance is provisioned: the mocked APDU answers the command directly. The
  // last test is the opposite — it opens the real app and registers no mock.
  test("returns the app config when skipOpenApp is set", async ({
    device,
    mockClient,
    xrpSigner,
  }) => {
    await test.step("Given a connected Nano X answering GetAppConfig", async () => {
      const dev = await device.addAndConnect(NANO_X_WITH_XRP);
      await mockClient.addMock(dev.id, {
        prefix: GET_APP_CONFIG_PREFIX,
        response: APP_CONFIG_RESPONSE,
      });
    });

    await test.step("When Get App Config is executed with skipOpenApp", async () => {
      await xrpSigner.open();
      await xrpSigner.getAppConfig({ skipOpenApp: true });
    });

    await test.step("Then the app version is returned", async () => {
      const result = await xrpSigner.lastResult<AppConfigOutput>();

      expect(result.status).toBe("completed");
      expect(result.output).toEqual({ version: EXPECTED_VERSION });
    });
  });

  test("surfaces the XRP app error when the device rejects", async ({
    device,
    mockClient,
    xrpSigner,
  }) => {
    await test.step("Given a connected Nano X rejecting GetAppConfig", async () => {
      const dev = await device.addAndConnect(NANO_X_WITH_XRP);
      await mockClient.addMock(dev.id, {
        prefix: GET_APP_CONFIG_PREFIX,
        response: REJECTED_RESPONSE,
      });
    });

    await test.step("When Get App Config is executed with skipOpenApp", async () => {
      await xrpSigner.open();
      await xrpSigner.getAppConfig({ skipOpenApp: true });
    });

    await test.step("Then the 6985 status word is surfaced as an XRP app error", async () => {
      const error = await xrpSigner.lastError();

      expect(error).toContain("XrpAppCommandError");
      expect(error).toContain("errorCode: '6985'");
      expect(error).toContain(
        "Condition of use not satisfied (Rejected by user)",
      );
    });
  });

  test("returns the app config from the real XRP app", async ({
    device,
    mockClient,
    xrpSigner,
  }) => {
    // Opening the XRP app provisions a real Speculos instance. The mock server
    // alone waits up to 120s for the pod to become ready, so the budget here is
    // larger than that to keep a slow cold start diagnosable instead of an
    // opaque Playwright timeout.
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with the XRP app and no APDU mock", async () => {
      // Registering no mock is the load-bearing difference with the tests
      // above: the Open App APDU falls through to the Speculinho proxy, and
      // every APDU after it — `e0060000` included — reaches the emulator.
      dev = await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When Get App Config is executed without skipOpenApp", async () => {
      await xrpSigner.open();
      // skipOpenApp defaults to false, so the device action opens the XRP app
      // before sending the command. Were it to regress to true, the command
      // would reach the dashboard instead and fail rather than silently pass.
      await xrpSigner.getAppConfig();
    });

    await test.step("Then the version reported by the app is returned", async () => {
      const result = await xrpSigner.lastResult<AppConfigOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      // The emulated app reports the version of the ELF that was booted, which
      // is the one the device config asked for.
      expect(result.output!.version).toBe(XRP_APP_VERSION);
    });

    await test.step("And a live Speculos instance was backing the device", async () => {
      // Proves the version above came from an emulator rather than a mock:
      // this throws when the device has no active Speculos instance.
      const instance = await mockClient.getSpeculos(dev.id);

      expect(instance.speculos_url).toMatch(/^https?:\/\//);
      expect(instance.model.toLowerCase()).toBe("stax");
    });
  });
});
