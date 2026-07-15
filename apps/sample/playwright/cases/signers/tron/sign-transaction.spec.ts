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

// A plain TRX TransferContract (protobuf-serialized `raw_data`, hex-encoded):
// the hw-app-trx test vector. Natively parsed by the Tron app, so the review
// can be approved on screen without any extra device setting.
const RAW_TRANSFER_TX =
  "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d";

// The signature is a 65-byte buffer (r[32] + s[32] + v[1]), rendered by the
// sample app as a 0x-prefixed hex string.
const SIGNATURE_RE = /^0x[0-9a-f]{130}$/i;

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
      expect(result.output).toMatch(SIGNATURE_RE);
    });
  });
});
