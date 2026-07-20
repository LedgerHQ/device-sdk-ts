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
    { name: "Tron", version: "0.5.0" },
  ],
  masks: [0x33200000],
};

// The hw-app-trx getECDHPairKey doc vector: a peer's uncompressed secp256k1
// public key (65 bytes, hex-encoded).
const PEER_PUBLIC_KEY =
  "04ff21f8e64d3a3c0198edfbb7afdc79be959432e92e2f8a1984bb436a414b8edcec0345aad0c1bf7da04fd036dd7f9f617e30669224283d950fab9dd84831dc83";

// The ECDH shared point (0x04 || X || Y) is a 65-byte buffer, rendered by the
// sample app as a 0x-prefixed hex string.
const SECRET_RE = /^0x[0-9a-f]{130}$/i;

test.describe("signer tron: get ecdh secret", () => {
  test("computes a shared secret approved on the device screen", async ({
    device,
    trxSigner,
    speculos,
  }) => {
    // Opening the Tron app provisions a real Speculos instance and the ECDH
    // operation must be reviewed/approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Tron app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Get ECDH secret is executed", async () => {
      await trxSigner.open();
      await trxSigner.getECDHSecret(PEER_PUBLIC_KEY);
    });

    await test.step("And the operation is approved on the Speculos screen", async () => {
      // The Tron app shows the ECDH review as a "Sign transaction to share
      // ECDH secret" hold-to-sign flow, which approveSigning() drives to the
      // last page and holds. If the app's review markers ever diverge from the
      // shared transaction-review markers, this step is where it would surface.
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approveSigning();
    });

    await test.step("Then a valid shared secret is returned", async () => {
      const result = await trxSigner.lastResult<string>();

      expect(result.status).toBe("completed");
      expect(result.output).toMatch(SECRET_RE);
    });
  });
});
