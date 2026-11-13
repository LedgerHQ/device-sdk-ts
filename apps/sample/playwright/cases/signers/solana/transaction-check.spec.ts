import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

// Solana 1.17.1 is the first app with generic clear signing, pinned on the OS
// the clear-signing tester runs it with.
const STAX_WITH_GENERIC_SOLANA: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.10.1",
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "Solana", version: "1.17.1" },
  ],
  masks: [0x33200000],
};

// Solana 1.16.1, as in sign-transaction.spec.ts: Transaction Check without
// generic clear signing, so the basic path alone is involved.
const STAX_WITH_SOLANA: DeviceConfig = {
  ...STAX_WITH_GENERIC_SOLANA,
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "Solana", version: "1.16.1" },
  ],
};

// The SOL transfer of sign-transaction.spec.ts: 0.001 SOL from 44'/501'/0'/0'
// (8dzfFpL3fBFch2fPUSFufamU7FpFv2p4Ef11W5WbU5iq), with its deterministic
// signature from the fixed Speculos seed.
const SOL_TRANSFER =
  "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDcXvp20rbGUx9dngi9uy2zJiOOkhpBLCXGis0Q6cESQIYbb31+bUL2DJIIA8o2kxuKuEBBsRxSSk/K7T4wdWOGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxJrndgN4IFTxep3s6kO0ROug7bEsbx0xxuDkqEvwUusBAgIAAQwCAAAAQEIPAAAAAAA=";
const EXPECTED_SIGNATURE =
  "0x2d7771a3b8e43acf6c0a0062c51dacb77d7b2a259a11ca9f429c65b5f204edc87c7fa56670c8276f8b5f816fdffe2996e20322967b98029c43719441577e8e07";

// ProvideInstructionInfo, the first generic clear-signing descriptor. Answering
// it on the mock server keeps it from Speculos, so the app itself fails the
// generic session, and a failed session wipes every context the app holds,
// the transaction check included.
const PROVIDE_INSTRUCTION_INFO_PREFIX = "e024";

// ProvideTransactionCheck with P1 0x00, the descriptor chunks; the opt-in is
// P1 0x01, so it still reaches the device.
const PROVIDE_TRANSACTION_CHECK_PREFIX = "e02300";

// The Web3 Checks scan the signer requests for a Solana transaction.
const SOLANA_SCAN_URL = "**/transaction-checks/**/solana/scan/tx";

const GENERIC_CLEAR_SIGN_STEP =
  "signer.sol.steps.provideGenericClearSignContext";
const TRANSACTION_CHECK_STEP = "signer.sol.steps.transactionChecksProvide";

const UNAVAILABLE = "Transaction Check unavailable";

const reviewText = (screens: string[]): string =>
  screens.join(" ").replace(/\s+/g, " ");

// Traces record localStorage and request headers, which hold the gating token,
// and they are uploaded as a public CI artifact.
test.use({ trace: "off" });

test.describe("signer solana: sign transaction with Transaction Check", () => {
  test("provides the check again when generic clear signing falls back", async ({
    device,
    mockClient,
    solSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with Solana 1.17.1 is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_GENERIC_SOLANA);
    });

    await test.step("And the generic clear-signing descriptor never reaches the device", async () => {
      await mockClient.addMock(dev.id, {
        prefix: PROVIDE_INSTRUCTION_INFO_PREFIX,
        response: "9000",
      });
    });

    await test.step("When Sign transaction is executed for a SOL transfer", async () => {
      await solSigner.open();
      await solSigner.signTransaction(SOL_TRANSFER);
    });

    const emulator = speculos(dev);
    await test.step("And the Transaction Check is enabled and the review approved", async () => {
      await emulator.waitReady();
      await emulator.approveSigning({ enableTransactionCheck: true });
    });

    // No verdict to assert: the backend can't simulate a transfer from the unfunded Speculos key.
    await test.step("Then the fallback review signs the transaction", async () => {
      const result = await solSigner.lastResult<string>();
      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_SIGNATURE);
    });

    await test.step("And the signer provided the check again after generic clear signing failed", async () => {
      const steps = await solSigner.steps();
      const generic = steps.indexOf(GENERIC_CLEAR_SIGN_STEP);
      expect(generic, "generic clear signing never started").not.toBe(-1);
      expect(steps.slice(generic + 1)).toContain(TRANSACTION_CHECK_STEP);
    });
  });

  test("still signs when the device refuses the check", async ({
    device,
    mockClient,
    solSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Solana app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_SOLANA);
    });

    await test.step("And the device refuses the transaction check", async () => {
      await mockClient.addMock(dev.id, {
        prefix: PROVIDE_TRANSACTION_CHECK_PREFIX,
        response: "6a80",
      });
    });

    await test.step("When Sign transaction is executed for a SOL transfer", async () => {
      await solSigner.open();
      await solSigner.signTransaction(SOL_TRANSFER);
    });

    const emulator = speculos(dev);
    let screens: string[] = [];
    await test.step("And the Transaction Check is enabled and the review approved", async () => {
      await emulator.waitReady();
      screens = await emulator.approveSigning({ enableTransactionCheck: true });
    });

    await test.step("Then the review says the check is unavailable and the transaction is signed", async () => {
      expect(reviewText(screens)).toContain(UNAVAILABLE);

      const result = await solSigner.lastResult<string>();
      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_SIGNATURE);
    });
  });

  test("still signs when the Transaction Check backend fails", async ({
    page,
    device,
    solSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let scans = 0;
    await test.step("Given the Transaction Check backend answers with an error", async () => {
      await page.route(SOLANA_SCAN_URL, async (route) => {
        scans += 1;
        await route.fulfill({
          status: 500,
          headers: { "access-control-allow-origin": "*" },
          body: "",
        });
      });
    });

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("And the device with the Solana app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_SOLANA);
    });

    await test.step("When Sign transaction is executed for a SOL transfer", async () => {
      await solSigner.open();
      await solSigner.signTransaction(SOL_TRANSFER);
    });

    const emulator = speculos(dev);
    let screens: string[] = [];
    await test.step("And the Transaction Check is enabled and the review approved", async () => {
      await emulator.waitReady();
      screens = await emulator.approveSigning({ enableTransactionCheck: true });
    });

    await test.step("Then the review says the check is unavailable and the transaction is signed", async () => {
      expect(scans, "the signer never requested a scan").toBeGreaterThan(0);
      expect(reviewText(screens)).toContain(UNAVAILABLE);

      const result = await solSigner.lastResult<string>();
      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_SIGNATURE);
    });
  });
});
