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

// Deterministic: fixed Speculos seed (well-known test mnemonic) + derivation
// path 44'/501'/0'/0', derived with SLIP-0010 outside DMK.
const EXPECTED_ADDRESS = "8dzfFpL3fBFch2fPUSFufamU7FpFv2p4Ef11W5WbU5iq";

test.describe("signer solana: get address", () => {
  test("returns the address for the default derivation path", async ({
    device,
    solSigner,
  }) => {
    // Opening the Solana app provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given the device with the Solana app is connected", async () => {
      await device.addAndConnect(STAX_WITH_SOLANA);
    });

    await test.step("When Get address is executed with default inputs", async () => {
      await solSigner.open();
      await solSigner.getAddress();
    });

    await test.step("Then the expected Solana address is returned", async () => {
      const result = await solSigner.lastResult<string>();

      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_ADDRESS);
    });
  });

  test("validates the address on the device screen", async ({
    device,
    solSigner,
    speculos,
  }) => {
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Solana app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_SOLANA);
    });

    await test.step("When Get address is executed with on-device verification", async () => {
      await solSigner.open();
      await solSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 60_000 })
        .toContain("Verify Solana address");
      // The address is on the second page, which holds the Confirm button.
      await emulator.touch().navigateNext();
      await expect
        .poll(() => emulator.currentScreen())
        .toContain("8dzfFpL3fBFch2fPUS");
      await emulator.touch().mainButton();
    });

    await test.step("Then the expected Solana address is returned", async () => {
      const result = await solSigner.lastResult<string>();

      expect(result.status).toBe("completed");
      expect(result.output).toBe(EXPECTED_ADDRESS);
    });
  });
});
