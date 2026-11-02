/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_TRX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Tron", version: "0.7.4" },
  ],
  masks: [0x33200000],
};

// A plain TRX TransferContract with no `data` field (protobuf-serialized
// `raw_data`, hex-encoded), derived from the hw-app-trx test vector with its
// memo stripped. The Tron app clear-signs a bare transfer natively, so the
// review can be approved on screen without enabling the "Allow data in
// transactions" setting - a transaction carrying `data` is rejected with 6a8b
// and never shows a review.
const RAW_TRANSFER_TX =
  "0a023dce220895da42177db0050740d8e0a5feed2d5a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d";

// The 65-byte signature (r[32] + s[32] + v[1]), rendered by the sample app as a
// 0x-prefixed hex string. Deterministic (RFC 6979) for the fixed Speculos seed
// and 44'/195'/0'/0/0; it recovers the address's public key from
// the sha256 of the raw transaction outside DMK.
const EXPECTED_SIGNATURE =
  "0xcea9f6b444f07f5cac4b68d08c0d9204427ba2c744d91cbc8cf65a47680df87b47e7b75de15062a56178a751ce0ebfea526fb6dcfedb2f2abae179fdece3b07500";

test.describe("signer tron: sign transaction", () => {
  test("signs a TRX transfer approved on the device screen", async ({
    device,
    trxSigner,
    speculos,
  }) => {
    // Opening the Tron app provisions a real Speculos instance and the
    // transaction must be reviewed/approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Tron app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Sign transaction is executed for a TRX transfer", async () => {
      await trxSigner.open();
      await trxSigner.signTransaction(RAW_TRANSFER_TX);
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approveSigning();
    });

    await test.step("Then a valid signature is returned", async () => {
      const result = await trxSigner.lastResult<string>();

      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_SIGNATURE);
    });
  });
});
