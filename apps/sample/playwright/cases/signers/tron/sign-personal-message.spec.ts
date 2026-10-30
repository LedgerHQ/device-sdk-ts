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

const MESSAGE = "Hello World";

// The 65-byte signature (r[32] + s[32] + v[1]), rendered by the sample app as a
// 0x-prefixed hex string. Deterministic (RFC 6979) for the fixed Speculos seed
// and 44'/195'/0'/0/0; it recovers the address's public key from
// the TRON-prefixed keccak256 of the message outside DMK.
const EXPECTED_SIGNATURE =
  "0x9dee060bac53576666342ef151e8c3d8b82e5a381ca7afcf0136b0dcc215056b4f95d12d744159e9912c6830253949a3abf2569acb0b59c446f797e8314a867f00";

test.describe("signer tron: sign personal message", () => {
  test("signs a personal message approved on the device screen", async ({
    device,
    trxSigner,
    speculos,
  }) => {
    // Opening the Tron app provisions a real Speculos instance and the
    // message must be reviewed/approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Tron app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Sign personal message is executed", async () => {
      await trxSigner.open();
      await trxSigner.signPersonalMessage(MESSAGE);
    });

    await test.step("And the message is approved on the Speculos screen", async () => {
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
