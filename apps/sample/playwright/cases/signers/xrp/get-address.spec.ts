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

// Latest Stax combo carrying an XRP build in coin-apps
// (`stax/1.10.1/XRP/app_2.6.1.elf`).
const STAX_WITH_XRP: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.10.1",
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "XRP", version: "2.6.1" },
  ],
  masks: [0x33200000],
};

// GetAddress APDU: CLA e0, INS 02, P1 00 (no display), P2 40 (secp256k1).
const GET_ADDRESS_PREFIX = "e0020040";

const toHex = (bytes: number[]) =>
  bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

// Uncompressed secp256k1 key: 0x04 then two 32-byte coordinates.
const PUBLIC_KEY_BYTES = [
  0x04,
  ...Array.from({ length: 64 }, (_, i) => (i + 1) & 0xff),
];
const MOCK_ADDRESS = "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv";

// The app answers [pkLen][publicKey][addressLen][address] then 9000.
const GET_ADDRESS_RESPONSE =
  toHex([
    PUBLIC_KEY_BYTES.length,
    ...PUBLIC_KEY_BYTES,
    MOCK_ADDRESS.length,
    ...Array.from(MOCK_ADDRESS, (c) => c.charCodeAt(0)),
  ]) + "9000";

// "Condition of use not satisfied (Rejected by user)".
const REJECTED_RESPONSE = "6985";

// XRP addresses are base58 and start with an `r`.
const XRP_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// The secp256k1 address the emulator derives at the sample's default path
// (44'/144'/0'/0/0) from the mock server's default Speculos seed — the
// well-known test mnemonic — so it is stable across runs.
const SPECULOS_ADDRESS = "rBxq9sFZKwW1vtiLr2ndBccoFQwtPyiUpA";

interface GetAddressOutput {
  publicKey: string;
  address: string;
  chainCode?: string;
}

test.describe("signer xrp: get address", () => {
  test("returns the address when skipOpenApp is set", async ({
    device,
    mockClient,
    xrpSigner,
  }) => {
    await test.step("Given a connected Nano X answering GetAddress", async () => {
      const dev = await device.addAndConnect(NANO_X_WITH_XRP);
      await mockClient.addMock(dev.id, {
        prefix: GET_ADDRESS_PREFIX,
        response: GET_ADDRESS_RESPONSE,
      });
    });

    await test.step("When Get Address is executed with skipOpenApp", async () => {
      await xrpSigner.open();
      await xrpSigner.getAddress({ skipOpenApp: true });
    });

    await test.step("Then the public key and the address are returned", async () => {
      const result = await xrpSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.publicKey).toBe(toHex(PUBLIC_KEY_BYTES));
      // Passed through as-is: no `0x` prefix, unlike the Ethereum signer.
      expect(result.output!.address).toBe(MOCK_ADDRESS);
      expect(result.output!.chainCode).toBeUndefined();
    });
  });

  test("surfaces the XRP app error when the device rejects", async ({
    device,
    mockClient,
    xrpSigner,
  }) => {
    await test.step("Given a connected Nano X rejecting GetAddress", async () => {
      const dev = await device.addAndConnect(NANO_X_WITH_XRP);
      await mockClient.addMock(dev.id, {
        prefix: GET_ADDRESS_PREFIX,
        response: REJECTED_RESPONSE,
      });
    });

    await test.step("When Get Address is executed with skipOpenApp", async () => {
      await xrpSigner.open();
      await xrpSigner.getAddress({ skipOpenApp: true });
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

  test("returns an address from the real XRP app", async ({
    device,
    xrpSigner,
  }) => {
    // Opening the XRP app provisions a real Speculos instance. The mock server
    // alone waits up to 120s for the pod, so the budget here is larger.
    test.setTimeout(180_000);

    await test.step("Given a connected Stax with the XRP app and no APDU mock", async () => {
      await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When Get Address is executed without skipOpenApp", async () => {
      await xrpSigner.open();
      await xrpSigner.getAddress();
    });

    await test.step("Then a valid XRP address is returned", async () => {
      const result = await xrpSigner.lastResult<GetAddressOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      expect(result.output!.address).toBe(SPECULOS_ADDRESS);
      // app-xrp 2.6.1 answers with a *compressed* secp256k1 key (33 bytes,
      // `02`/`03` prefix), not the uncompressed one the APDU spec describes.
      // The command reads the key by its length prefix, so both parse — the
      // mocked test above feeds it a 65 byte key for exactly that reason.
      expect(result.output!.publicKey).toMatch(/^0[23][0-9a-f]{64}$/);
      expect(result.output!.chainCode).toBeUndefined();
    });
  });

  test("returns the chain code from the real XRP app when requested", async ({
    device,
    xrpSigner,
  }) => {
    test.setTimeout(180_000);

    await test.step("Given a connected Stax with the XRP app", async () => {
      await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When Get Address is executed with returnChainCode", async () => {
      await xrpSigner.open();
      await xrpSigner.getAddress({ returnChainCode: true });
    });

    await test.step("Then a 32 byte chain code comes back with the address", async () => {
      const result = await xrpSigner.lastResult<GetAddressOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      expect(result.output!.address).toMatch(XRP_ADDRESS_RE);
      expect(result.output!.chainCode).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  test("validates the address on the device screen", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    // The address has to be approved on screen, so this flow is slow.
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with the XRP app", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When Get Address is executed with on-device verification", async () => {
      await xrpSigner.open();
      await xrpSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      // The XRP app spreads the confirmation over two pages ("Verify XRP
      // Address / Swipe to continue", then the address itself), so it has to be
      // paged before the approval gesture lands on the right screen.
      await emulator.waitForAnyScreen();
      // The app spreads the confirmation over two pages:
      //   1 of 2  "Verify XRP Address / Swipe to continue / Cancel"
      //   2 of 2  "Address <addr> / Cancel / Confirm"
      // The second page ends in a Confirm button rather than a hold-to-sign,
      // so `approve()` (which holds) would miss it — page over, then tap the
      // main button.
      await emulator.touch().navigateNext();
      await emulator.attachScreenshot("confirm-address");
      await emulator.touch().mainButton();
    });

    await test.step("Then a valid XRP address is returned", async () => {
      const result = await xrpSigner.lastResult<GetAddressOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      // The very address that was shown on, and confirmed from, the screen.
      expect(result.output!.address).toBe(SPECULOS_ADDRESS);
    });
  });
});
