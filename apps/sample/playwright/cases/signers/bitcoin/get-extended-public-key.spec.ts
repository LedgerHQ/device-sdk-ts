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

interface GetExtendedPublicKeyOutput {
  extendedPublicKey: string;
}

test.describe("signer bitcoin: get extended public key", () => {
  test("returns an extended public key with default inputs", async ({
    device,
    btcSigner,
  }) => {
    // Opening the Bitcoin app provisions a real Speculos instance, which can
    // take a while to become ready.
    test.setTimeout(120_000);

    await test.step("Given the device with the Bitcoin app is connected", async () => {
      await device.addAndConnect(NANO_X_WITH_BTC);
    });

    await test.step("When Get extended public key is executed with default inputs", async () => {
      await btcSigner.open();
      await btcSigner.getExtendedPublicKey();
    });

    await test.step("Then a valid extended public key is returned", async () => {
      const result = await btcSigner.lastResult<GetExtendedPublicKeyOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.extendedPublicKey).toMatch(
        /^xpub[1-9A-HJ-NP-Za-km-z]+$/,
      );
    });
  });
});
