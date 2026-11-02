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

// First receive address (…/0/0) of each default wallet, for the fixed Speculos
// seed, derived with BIP-32 and bitcoinjs-lib outside DMK.
const WALLETS = [
  { type: "Legacy", address: "1HDsMRsP5Z89dgNt6s8o3bMHWdHCyoKmPS" },
  { type: "Nested Segwit", address: "3Fy2M6nn8deLNXa4W9hh6htbjC3EcyAtjd" },
  {
    type: "Native Segwit",
    address: "bc1qt3sltyj62m8ensmq2ncs2cax5p8u37n93m9xyy",
  },
  {
    type: "Taproot",
    address: "bc1psdtzmv9qd9ktrh9l6h9fkt2rntyk3tfcj9fkhw258k2qp3730yqq2h92g3",
  },
];

interface GetWalletAddressOutput {
  address: string;
}

test.describe("signer bitcoin: get wallet address", () => {
  for (const { type, address } of WALLETS) {
    test(`returns the first ${type} receive address`, async ({
      device,
      btcSigner,
    }) => {
      // Opening the Bitcoin app provisions a real Speculos instance.
      test.setTimeout(120_000);

      await test.step("Given the device with the Bitcoin app is connected", async () => {
        await device.addAndConnect(NANO_X_WITH_BTC);
      });

      await test.step(`When Get wallet address is executed for a ${type} wallet`, async () => {
        await btcSigner.open();
        await btcSigner.getWalletAddress(type);
      });

      await test.step("Then the expected address is returned", async () => {
        const result = await btcSigner.lastResult<GetWalletAddressOutput>();

        expect(result.status).toBe("completed");
        expect(result.output!.address).toBe(address);
      });
    });
  }
});
