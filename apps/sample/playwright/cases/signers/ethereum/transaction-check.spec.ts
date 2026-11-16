/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const FLEX_WITH_ETH: DeviceConfig = {
  name: "Ledger Flex",
  device_type: "flex",
  connectivity_type: "USB",
  firmware_version: "1.7.0",
  apps: [
    { name: "BOLOS", version: "1.7.0" },
    { name: "Ethereum", version: "1.24.0" },
  ],
  masks: [0x33300000],
};

// Lido stETH approve (clear-signing-tester erc7730/lido): clear-signed with its
// ERC-7730 descriptor, and the Transaction Check backend can simulate it from
// the Speculos seed address.
const LIDO_APPROVE =
  "0x02f86d015b8405f5e100840fa6f5408301941594ae7ab96520de3a18e5e111b5eaab095312d7fe8480b844095ea7b3000000000000000000000000111111125421ca6dc452d289314280a0f8842a65ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0";

// Calldata to an address with no descriptor: blind-signed, but still simulated.
const UNKNOWN_CALL = JSON.stringify({
  to: "0x1234567890123456789012345678901234567890",
  nonce: 0,
  gasLimit: "50000",
  maxFeePerGas: "30000000000",
  maxPriorityFeePerGas: "1000000000",
  value: "0",
  data: "0xdeadbeef",
  chainId: 1,
  type: 2,
});

// ProvideTransactionInformation. Answering it on the mock server keeps the
// descriptor from Speculos, so the device itself fails the clear signing and
// resets its context, dropping the transaction check.
const PROVIDE_TRANSACTION_INFO_PREFIX = "e026";

const CLEAR_SIGNED_VERDICT = "No threat detected by Transaction Check.";
const BLIND_SIGNED_VERDICT =
  "No threat detected by Transaction Check but blind signing required.";

const reviewText = (screens: string[]): string =>
  screens.join(" ").replace(/\s+/g, " ");

// Traces record localStorage and request headers, which hold the gating token,
// and they are uploaded as a public CI artifact.
test.use({ trace: "off" });

test.describe("signer ethereum: sign transaction with Transaction Check", () => {
  test("shows the check verdict on a clear-signed transaction", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(FLEX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign transaction is executed for a Lido stETH approve", async () => {
      await ethSigner.open();
      await ethSigner.signTransaction(LIDO_APPROVE);
    });

    let screens: string[] = [];
    await test.step("And the Transaction Check is enabled and the review approved", async () => {
      screens = await emulator.approveSigning({ enableTransactionCheck: true });
    });

    await test.step("Then the clear-signed review shows the check verdict", async () => {
      const review = reviewText(screens);
      expect(review).toContain("Approve stETH");
      expect(review).toContain(CLEAR_SIGNED_VERDICT);

      const result = await ethSigner.lastResult();
      expect(result.status).toBe("completed");
    });
  });

  test("shows no check verdict when the user declines the Transaction Check", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(FLEX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign transaction is executed for a Lido stETH approve", async () => {
      await ethSigner.open();
      await ethSigner.signTransaction(LIDO_APPROVE);
    });

    let screens: string[] = [];
    await test.step("And the Transaction Check is declined and the review approved", async () => {
      screens = await emulator.approveSigning({
        enableTransactionCheck: false,
      });
    });

    await test.step("Then the clear-signed review shows no check verdict", async () => {
      const review = reviewText(
        screens.filter(
          (screen) => !screen.includes("Enable Transaction Check"),
        ),
      );
      expect(review).toContain("Approve stETH");
      expect(review).not.toContain("Transaction Check");

      const result = await ethSigner.lastResult();
      expect(result.status).toBe("completed");
    });
  });

  test("shows the check verdict on a blind-signed transaction", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(FLEX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign transaction is executed for a call without descriptor", async () => {
      await ethSigner.open();
      await ethSigner.signTransaction(UNKNOWN_CALL);
    });

    let screens: string[] = [];
    await test.step("And the Transaction Check is enabled and the review approved", async () => {
      screens = await emulator.approveSigning({ enableTransactionCheck: true });
    });

    await test.step("Then the blind-signed review shows the check verdict", async () => {
      expect(reviewText(screens)).toContain(BLIND_SIGNED_VERDICT);

      const result = await ethSigner.lastResult();
      expect(result.status).toBe("completed");
    });
  });

  test("shows the check verdict when clear signing falls back to blind signing", async ({
    device,
    ethSigner,
    mockClient,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(FLEX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("And the transaction information never reaches the device", async () => {
      await mockClient.addMock(dev.id, {
        prefix: PROVIDE_TRANSACTION_INFO_PREFIX,
        response: "9000",
      });
    });

    await test.step("When Sign transaction is executed for a Lido stETH approve", async () => {
      await ethSigner.open();
      await ethSigner.signTransaction(LIDO_APPROVE);
    });

    let screens: string[] = [];
    await test.step("And the Transaction Check is enabled and the review approved", async () => {
      screens = await emulator.approveSigning({ enableTransactionCheck: true });
    });

    await test.step("Then the blind-signed fallback review shows the check verdict", async () => {
      expect(reviewText(screens)).toContain(BLIND_SIGNED_VERDICT);

      const result = await ethSigner.lastResult();
      expect(result.status).toBe("completed");
    });
  });
});
