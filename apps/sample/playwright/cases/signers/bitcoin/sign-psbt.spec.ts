/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const NANO_X_WITH_BTC: DeviceConfig = {
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

// Spends a 0.001 BTC UTXO of 84'/0'/0'/0/0 to 1HDsMRsP5Z89dgNt6s8o3bMHWdHCyoKmPS
// (0.0009 BTC, 0.0001 BTC fees). Built with bitcoinjs-lib, carrying both the
// witness and the non-witness UTXO, and the BIP-32 derivation under the seed's
// master fingerprint bb6cd217.
const PSBT =
  "cHNidP8BAFUCAAAAAX+eXMxhwvnk/OF3JlAzfK87khHTMbmNXeenI4Y/BUgXAAAAAAD/////AZBfAQAAAAAAGXapFLHxCTc0LouRAyIautBOku4fCwrtiKwAAAAAAAEAUgIAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAAAAAP////8BoIYBAAAAAAAWABRcYfWSWlbPmcNgVPEFY6agT8j6ZQAAAAABAR+ghgEAAAAAABYAFFxh9ZJaVs+Zw2BU8QVjpqBPyPplIgYD5R3c67/pUtIGZKJipK/a3iyYRYbKsz84JPcP9d842ZgYu2zSF1QAAIAAAACAAAAAgAAAAAAAAAAAAAA=";

interface SignPsbtOutput {
  inputIndex: number;
  signature: string;
  pubkey: string;
}

test.describe("signer bitcoin: sign psbt", () => {
  test("signs a native segwit PSBT approved on the device screen", async ({
    device,
    btcSigner,
    speculos,
  }) => {
    // Opening the Bitcoin app provisions a real Speculos instance and the
    // transaction must be reviewed on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Bitcoin app is connected", async () => {
      dev = await device.addAndConnect(NANO_X_WITH_BTC);
    });

    await test.step("When Sign psbt is executed", async () => {
      await btcSigner.open();
      await btcSigner.signPsbt(PSBT);
    });

    await test.step("And the transaction is reviewed and approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 60_000 })
        .toContain("Review transaction");
      for (const screen of [
        "Amount 0.0009 BTC",
        "To 1HDsMRsP5Z89dgNt6",
        "Fees 0.0001 BTC",
        "Sign transaction",
      ]) {
        await emulator.buttons().right();
        await expect.poll(() => emulator.currentScreen()).toContain(screen);
      }
      await emulator.buttons().both();
    });

    await test.step("Then the expected signature is returned", async () => {
      const result = await btcSigner.lastResult<SignPsbtOutput[]>();

      expect(result.status).toBe("completed");
      // Deterministic (RFC 6979) for the fixed Speculos seed. It verifies
      // against the BIP-143 sighash of the input (SIGHASH_ALL) outside DMK.
      expect(result.output).toEqual([
        {
          inputIndex: 0,
          signature:
            "0x3044022015279b529fc7a35366863775809ce4aa73a13bb7bcb345649b7c2c677128ccc702202d4af447647414e3e67d7ef0bc3008c6503df991e193a25b3b722bcd16803b4b01",
          pubkey:
            "0x03e51ddcebbfe952d20664a262a4afdade2c984586cab33f3824f70ff5df38d998",
        },
      ]);
    });
  });
});
