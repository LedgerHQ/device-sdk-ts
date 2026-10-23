/* eslint-disable no-restricted-imports */
import { createPublicKey, verify } from "node:crypto";

import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";
import { Curve } from "@ledgerhq/device-signer-kit-xrp";

import { expect, test } from "../../../fixtures";

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

// Ed25519 signing needs app-xrp 2.8.0 or later, see get-address.spec.ts.
const STAX_WITH_XRP_ED25519: DeviceConfig = {
  ...STAX_WITH_XRP,
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "XRP", version: "2.8.2" },
  ],
};

// Both blobs are ripple-binary-codec encoded Payments from the emulator's own
// address, produced with `encode()` from that library. The first fits a single
// APDU; the second carries a long memo so the payload spans two chunks, which
// is what exercises SendSignTransactionTask's loop against the real app.
//
// 105 bytes, so 126 with the derivation path prefix: one chunk.
const PAYMENT =
  "12000024000000026140000000000F424068400000000000000C73210324E5F600B52BB3D9246D49C4AB1722BA7F32B7A3E4F9F2B8A1A28B9118CC36C48114784051E8B60F89B51417D1D10AE5B7D8EEAF6CDF8314B5F762798A53D543A014CAF8B297CFF8F2F937E8";

// 425 bytes, so 446 with the prefix: two chunks, the first one full.
const PAYMENT_WITH_MEMO =
  "12000024000000026140000000000F424068400000000000000C73210324E5F600B52BB3D9246D49C4AB1722BA7F32B7A3E4F9F2B8A1A28B9118CC36C48114784051E8B60F89B51417D1D10AE5B7D8EEAF6CDF8314B5F762798A53D543A014CAF8B297CFF8F2F937E8F9EA7C0B6465736372697074696F6E7DC16B787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878E1F1";

// PAYMENT sent from the emulator's Ed25519 account: same fields, with its key as
// SigningPubKey and its account ID as Account.
const ED25519_PAYMENT =
  "12000024000000026140000000000F424068400000000000000C7321EDF49BDEEDB26DA2642B5DABDC1AE40185C79EC78C5952F2499D58239881A41C7E8114B8055308CD0ACE21F0C9CABFF9D0E4F662D539818314B5F762798A53D543A014CAF8B297CFF8F2F937E8";

const fromHex = (hex: string) =>
  Uint8Array.from(hex.replace(/^0x/, "").match(/../g) ?? [], (byte) =>
    parseInt(byte, 16),
  );

// XRPL signs `STX\0` followed by the serialized transaction.
const SIGNING_PREFIX = "53545800";

// The Ed25519 key the emulator derives at the default path (44'/144'/0'/0/0),
// `edf49bde…a41c7e`, without its `ED` marker and as a JWK `x` (base64url).
const ED25519_JWK_X = "9Jve7bJtomQrXavcGuQBhceex4xZUvJJnVgjmIGkHH4";

const verifiesWithEd25519Key = (signatureHex: string): boolean =>
  verify(
    null,
    fromHex(SIGNING_PREFIX + ED25519_PAYMENT),
    createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: ED25519_JWK_X },
      format: "jwk",
    }),
    fromHex(signatureHex),
  );

// The signature is a Uint8Array, which the sample renders as a 0x-prefixed hex
// string. DER wraps the pair in a SEQUENCE (0x30) whose first element is an
// INTEGER (0x02).
const DER_SIGNATURE_RE = /^0x30[0-9a-f]{2}02[0-9a-f]+$/i;

type SignTransactionOutput = string;

test.describe("signer xrp: sign transaction", () => {
  test("signs a payment that fits a single APDU", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with the XRP app", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When the payment is submitted for signing", async () => {
      await xrpSigner.open();
      await xrpSigner.signTransaction(PAYMENT);
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approveSigning();
    });

    await test.step("Then a DER signature is returned", async () => {
      const result = await xrpSigner.lastResult<SignTransactionOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      expect(result.output).toMatch(DER_SIGNATURE_RE);
    });
  });

  test("signs a payment spanning several APDU chunks", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with the XRP app", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When a payment carrying a memo is submitted", async () => {
      // 446 bytes once the derivation path is prepended, so the task has to
      // split it into two chunks and only the second returns a signature.
      await xrpSigner.open();
      await xrpSigner.signTransaction(PAYMENT_WITH_MEMO);
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approveSigning();
    });

    await test.step("Then a DER signature is returned", async () => {
      const result = await xrpSigner.lastResult<SignTransactionOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      expect(result.output).toMatch(DER_SIGNATURE_RE);
    });
  });

  test("surfaces the app error when the transaction is rejected", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with the XRP app", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP);
    });

    await test.step("When the payment is submitted for signing", async () => {
      await xrpSigner.open();
      await xrpSigner.signTransaction(PAYMENT);
    });

    await test.step("And the transaction is rejected on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.waitForAnyScreen();
      // Rejecting takes two taps: "Reject" on the review page, then "Yes,
      // reject" on the confirmation modal it opens. Without the second the
      // APDU never gets an answer and the proxy times out into a 6d00, which
      // would look like a rejection to a laxer assertion.
      await emulator.touch().reject();
      await new Promise((r) => setTimeout(r, 1500));
      await emulator.touch().mainButton();
    });

    await test.step("Then the rejection is surfaced as an XRP app error", async () => {
      const error = await xrpSigner.lastError({ timeout: 150_000 });

      // `reject_transaction` in app-xrp answers 6985, not the 6982 the ticket
      // describes.
      expect(error).toContain("XrpAppCommandError");
      expect(error).toContain("errorCode: '6985'");
      expect(error).toContain(
        "Condition of use not satisfied (Rejected by user)",
      );
    });
  });

  test("signs a payment with the Ed25519 key", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with an XRP app supporting Ed25519", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP_ED25519);
    });

    await test.step("When a payment from the Ed25519 account is submitted on the Ed25519 curve", async () => {
      await xrpSigner.open();
      await xrpSigner.signTransaction(ED25519_PAYMENT, {
        curve: Curve.Ed25519,
      });
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approveSigning();
    });

    await test.step("Then a 64 byte signature valid for the Ed25519 key is returned", async () => {
      const result = await xrpSigner.lastResult<SignTransactionOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      expect(result.output).toMatch(/^0x[0-9a-f]{128}$/i);
      expect(verifiesWithEd25519Key(result.output!)).toBe(true);
    });
  });
});
