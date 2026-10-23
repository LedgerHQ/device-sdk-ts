/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const FLEX_WITH_LITECOIN: DeviceConfig = {
  name: "Ledger Flex",
  device_type: "flex",
  connectivity_type: "USB",
  firmware_version: "1.7.0",
  apps: [
    { name: "BOLOS", version: "1.7.0" },
    { name: "Litecoin", version: "2.4.13" },
  ],
  masks: [0x33300000],
};

// The xpubs of the mock server's default Speculos seed with Litecoin's xpub
// version (0x019da462, "Ltub"). Ledger Wallet's hw-app-btc
// (BtcOld.getWalletXpub) returns these for the same app answers, and an
// off-device BIP32 derivation of the seed gives them too.
const SPECULOS_XPUBS = [
  {
    derivationPath: "44'/2'/0'",
    extendedPublicKey:
      "Ltub2ZSqBrAXomM9KZFgqvqZHeh8sfsWZotuPMvyXrfUBdMADyYgzN4anz5AimpyvdDFJNyA2AX57iMBjzfrmy6QZTWevqNTVR36F2JuW7k333J",
  },
  {
    derivationPath: "49'/2'/0'",
    extendedPublicKey:
      "Ltub2ZpZYnWCyDi4tGt1YdrojVkod8o7h1j4jSc91kuEESPVZHu36BrtqUiZm2cm5p8kiPUuw4S82knuCW3g4V8eYNHbxur9Y35EJdL69hX7wwn",
  },
  {
    derivationPath: "84'/2'/0'",
    extendedPublicKey:
      "Ltub2YjqxJZ2tFm4yqCiWtdvp6AHH2zSNCqD8LyoLWL4AJhBc8NTHTTCCdCiBEnmjHvQ67LtUd63FxqXGgG8PPJrNC65fpBHqSKXZpf85J452uC",
  },
];

interface GetExtendedPublicKeyOutput {
  extendedPublicKey: string;
}

// Opening the Litecoin app provisions a real Speculos instance through the mock
// server, which alone waits up to 120s for the pod, so the budget is larger.
test.describe("signer litecoin: get extended public key", () => {
  for (const { derivationPath, extendedPublicKey } of SPECULOS_XPUBS) {
    test(`returns the xpub of ${derivationPath} from the Litecoin app`, async ({
      device,
      ltcSigner,
    }) => {
      test.setTimeout(180_000);

      await test.step("Given a connected Flex with the Litecoin app", async () => {
        await device.addAndConnect(FLEX_WITH_LITECOIN);
      });

      await test.step(`When Get extended public key is executed at ${derivationPath}`, async () => {
        await ltcSigner.open();
        await ltcSigner.getExtendedPublicKey({ derivationPath });
      });

      await test.step("Then the xpub of the Speculos seed is returned", async () => {
        const result = await ltcSigner.lastResult<GetExtendedPublicKeyOutput>({
          timeout: 150_000,
        });

        expect(result.status).toBe("completed");
        expect(result.output!.extendedPublicKey).toBe(extendedPublicKey);
      });
    });
  }
});
