import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const STAX_WITH_SOLANA: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.10.1",
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "Solana", version: "1.16.1" },
  ],
  masks: [0x33200000],
};

// A legacy transaction transferring 0.001 SOL from 44'/501'/0'/0'
// (8dzfFpL3fBFch2fPUSFufamU7FpFv2p4Ef11W5WbU5iq) to 44'/501'/0'
// (2eMqnf1SwJanSEaT36BCXKL2EWFezS4ZfqKNk69mLN8P), built with @solana/web3.js
// against a fixed blockhash, with an empty signature slot.
const SOL_TRANSFER =
  "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDcXvp20rbGUx9dngi9uy2zJiOOkhpBLCXGis0Q6cESQIYbb31+bUL2DJIIA8o2kxuKuEBBsRxSSk/K7T4wdWOGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxJrndgN4IFTxep3s6kO0ROug7bEsbx0xxuDkqEvwUusBAgIAAQwCAAAAQEIPAAAAAAA=";

// Ed25519 is deterministic: fixed Speculos seed + the transaction above. This
// signature was verified against the message and the sender's public key
// outside DMK.
const EXPECTED_SIGNATURE =
  "0x2d7771a3b8e43acf6c0a0062c51dacb77d7b2a259a11ca9f429c65b5f204edc87c7fa56670c8276f8b5f816fdffe2996e20322967b98029c43719441577e8e07";

test.describe("signer solana: sign transaction", () => {
  test("signs a SOL transfer clear-signed on the device screen", async ({
    device,
    solSigner,
    speculos,
  }) => {
    // Opening the Solana app provisions a real Speculos instance and the
    // transaction must be reviewed on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Solana app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_SOLANA);
    });

    await test.step("When Sign transaction is executed for a SOL transfer", async () => {
      await solSigner.open();
      await solSigner.signTransaction(SOL_TRANSFER);
    });

    const emulator = speculos(dev);
    await test.step("Then the device shows the amount and the recipient", async () => {
      await emulator.waitReady();
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
      await emulator.touch().navigateNext();
      await expect
        .poll(() => emulator.currentScreen())
        .toContain("Amount 0.001 SOL To 2eMqnf1SwJanSEaT3");
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      await emulator.approveSigning();
    });

    await test.step("Then the expected signature is returned", async () => {
      const result = await solSigner.lastResult<string>();

      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_SIGNATURE);
    });
  });
});
