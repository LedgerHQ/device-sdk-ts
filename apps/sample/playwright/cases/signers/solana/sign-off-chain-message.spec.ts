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

// The base58 signed envelope: signature count, the Ed25519 signature, then the
// V0 off-chain message ("\xffsolana offchain" header, signer
// 8dzfFpL3fBFch2fPUSFufamU7FpFv2p4Ef11W5WbU5iq, "Hello World"). Deterministic
// for the fixed Speculos seed; verified against the signer's public key
// outside DMK.
const EXPECTED_SIGNATURE =
  "CY6Revd3seHcMYfhh2MpHVLmzg97YEvwHFqpzjKMoXrj9gYFjnetUEMm7gnfnwNuToTYKhPCotuG37j4iapGw8FFPnPf7q2QSrQidgvfbkCzweb29cGdWJATcCj6MkpDS82RKa96jKdYBdqYECrBVMABDpSj7vno46A2PGdtzdp5tYnejqXhEB9ihn5GXpPALg4qP353C6Zqb4qMR52opL5wJaw";

test.describe("signer solana: sign off chain message", () => {
  test("signs a message approved on the device screen", async ({
    device,
    solSigner,
    speculos,
  }) => {
    // Opening the Solana app provisions a real Speculos instance and the
    // message must be reviewed on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Solana app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_SOLANA);
    });

    await test.step('When Sign off chain message is executed for "Hello World"', async () => {
      await solSigner.open();
      await solSigner.signOffChainMessage();
    });

    const emulator = speculos(dev);
    await test.step("Then the device shows the message", async () => {
      await emulator.waitReady();
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 60_000 })
        .toContain("Review message");
      await emulator.touch().navigateNext();
      await expect
        .poll(() => emulator.currentScreen())
        .toContain("Message Hello World");
    });

    await test.step("And the message is approved on the Speculos screen", async () => {
      await emulator.approveSigning();
    });

    await test.step("Then the expected signed message is returned", async () => {
      const result = await solSigner.lastResult<{ signature: string }>();

      expect(result.status).toBe("completed");
      expect(result.output?.signature).toBe(EXPECTED_SIGNATURE);
    });
  });
});
