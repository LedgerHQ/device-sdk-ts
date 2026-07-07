/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_ETH: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Ethereum", version: "1.22.0" },
  ],
  masks: [0x33200000],
};

// A plain native ETH transfer: clear-signable by the Ethereum app, so the review
// can be approved on screen without enabling blind signing.
const NATIVE_TRANSFER = JSON.stringify({
  to: "0x1234567890123456789012345678901234567890",
  nonce: 0,
  gasLimit: "21000",
  gasPrice: "20000000000",
  value: "1000000000000000",
  chainId: 1,
  type: 0,
});

interface SignTransactionOutput {
  r: string;
  s: string;
  v: number;
}

test.describe("signer ethereum: sign transaction", () => {
  test("signs a native transfer approved on the device screen", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    // Opening the Ethereum app provisions a real Speculos instance and the
    // transaction must be reviewed/approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      // Run Get address first so the Ethereum app is open (and the Speculos
      // instance provisioned), then toggle blind signing in its settings. The
      // mock environment has no clear-signing context, so the native transfer
      // would otherwise be blocked on the "enable blind signing" screen.
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign transaction is executed for a native transfer", async () => {
      // Re-open the Ethereum signer to return from the Get address tester to the
      // action list (selecting an action replaces the list).
      await ethSigner.open();
      await ethSigner.signTransaction(NATIVE_TRANSFER);
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      await emulator.approveSigning();
    });

    await test.step("Then the expected signature is returned", async () => {
      const result = await ethSigner.lastResult<SignTransactionOutput>();

      expect(result.status).toBe("completed");
      // Deterministic: fixed Speculos seed (well-known test mnemonic) +
      // derivation path 44'/60'/0'/0/0 + the fixed transaction above.
      expect(result.output).toEqual({
        v: 38,
        r: "0xe1efe34a50d21592aded657578cd13b2633f4e6d4c9a69c87beb8b7b9f0b4c28",
        s: "0x16a21f4f34dfa3cfec9de28758b6d73361218eb6d1d5b759d445e05d59afa44c",
      });
    });
  });
});
