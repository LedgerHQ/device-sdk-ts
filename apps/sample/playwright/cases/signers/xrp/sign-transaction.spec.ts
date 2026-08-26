/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

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
});
