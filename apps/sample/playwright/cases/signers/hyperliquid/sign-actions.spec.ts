import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X_WITH_HYPERLIQUID: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.8.0",
  apps: [
    { name: "BOLOS", version: "2.8.0" },
    { name: "Hyperliquid", version: "1.1.0" },
  ],
  masks: [0x33000000],
};

// The default order of the sample, reviewed screen by screen. The signer is the
// address of 44'/60'/0'/0' for the fixed Speculos seed, derived outside DMK.
const REVIEW = [
  "Protocol Hyperliquid",
  "Signer 0xe80fe2888f1f679e9",
  "Operation Market Long - ETH",
  "Max Price 1978.8 USDC",
  "Size 0.5154 ETH",
  "Sign message to  open long?",
];

interface SignActionsOutput {
  r: string;
  s: string;
  v: number;
}

test.describe("signer hyperliquid: sign actions", () => {
  test("signs an order approved on the device screen", async ({
    device,
    hyperliquidSigner,
    speculos,
  }) => {
    // Opening the Hyperliquid app provisions a real Speculos instance and the
    // order must be reviewed on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Hyperliquid app is connected", async () => {
      dev = await device.addAndConnect(NANO_X_WITH_HYPERLIQUID);
    });

    await test.step("When Sign Actions is executed for an ETH market order", async () => {
      await hyperliquidSigner.open();
      await hyperliquidSigner.signActions();
    });

    await test.step("And the order is reviewed and approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 60_000 })
        .toContain("Review message");
      for (const screen of REVIEW) {
        await emulator.buttons().right();
        await expect.poll(() => emulator.currentScreen()).toContain(screen);
      }
      await emulator.buttons().both();
    });

    await test.step("Then the expected signature is returned", async () => {
      const result = await hyperliquidSigner.lastResult<SignActionsOutput[]>();

      expect(result.status).toBe("completed");
      // Deterministic (RFC 6979), recorded from the app for the fixed seed.
      expect(result.output).toEqual([
        {
          v: 27,
          r: "4bbd5920ed1f37585be6d39488516b5bfd470780e3eaef3b8ae67644de422f9d",
          s: "53b9901782d26cceae75db818c89812921fbce363025b8079beec4089958848a",
        },
      ]);
    });
  });
});
