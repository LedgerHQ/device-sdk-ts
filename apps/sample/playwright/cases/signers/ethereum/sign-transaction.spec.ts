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

// The same transfer as an EIP-1559 (type 2) transaction.
const EIP1559_TRANSFER = JSON.stringify({
  to: "0x1234567890123456789012345678901234567890",
  nonce: 0,
  gasLimit: "21000",
  maxFeePerGas: "30000000000",
  maxPriorityFeePerGas: "1000000000",
  value: "1000000000000000",
  chainId: 1,
  type: 2,
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

  test("signs an EIP-1559 transfer approved on the device screen", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign transaction is executed for an EIP-1559 transfer", async () => {
      await ethSigner.open();
      await ethSigner.signTransaction(EIP1559_TRANSFER);
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      await emulator.approveSigning();
    });

    await test.step("Then the expected signature is returned", async () => {
      const result = await ethSigner.lastResult<SignTransactionOutput>();

      expect(result.status).toBe("completed");
      // Deterministic: the sender recovered from it with ethers is
      // 0x47609D32EdF0C2A046D8D1D22680A2F93c78661b.
      expect(result.output).toEqual({
        v: 0,
        r: "0xdc9825027e37e8dedee863c953f86b7635d25b45c542baf75b91456e54efcc19",
        s: "0x106984e550cf0c840665cf0a17ee33b1d0a0af6d15578f13ac2acef80a7066c4",
      });
    });
  });

  test("fails when the transaction is rejected on the device screen", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign transaction is executed for a native transfer", async () => {
      await ethSigner.open();
      await ethSigner.signTransaction(NATIVE_TRANSFER);
    });

    await test.step("And the transaction is rejected on the Speculos screen", async () => {
      // Decline the "Enable Transaction Check?" prompt shown before the review.
      await expect
        .poll(
          async () => {
            const screen = await emulator.currentScreen();
            if (screen.includes("Enable Transaction Check")) {
              await emulator.touch().secondaryButton();
              // Let the screen move on so the next sample does not tap again.
              await new Promise((r) => setTimeout(r, 1500));
            }
            return screen;
          },
          { timeout: 60_000 },
        )
        .toContain("Review transaction");
      // Rejecting takes two taps: "Reject" on the review, then "Yes, reject"
      // on the confirmation it opens.
      await emulator.touch().reject();
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 15_000 })
        .toContain("Yes, reject");
      await emulator.touch().mainButton();
    });

    await test.step("Then the rejection is surfaced as an app error", async () => {
      const error = await ethSigner.lastError();

      expect(error).toContain("EthAppCommandError");
      expect(error).toContain("errorCode: '6985'");
    });
  });
});
