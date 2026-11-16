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

interface SignMessageOutput {
  r: string;
  s: string;
  v: number;
}

test.describe("signer ethereum: sign message", () => {
  test("signs a personal message approved on the device screen", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    // Opening the Ethereum app provisions a real Speculos instance and the
    // message must be reviewed on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH);
    });

    await test.step('When Sign message is executed for "Hello World"', async () => {
      await ethSigner.open();
      await ethSigner.signMessage();
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

    await test.step("Then the expected signature is returned", async () => {
      const result = await ethSigner.lastResult<SignMessageOutput>();

      expect(result.status).toBe("completed");
      // Deterministic: fixed Speculos seed + 44'/60'/0'/0/0 + "Hello World".
      // It recovers to 0x47609D32EdF0C2A046D8D1D22680A2F93c78661b with ethers.
      expect(result.output).toEqual({
        v: 27,
        r: "0xc9548a24ec4745fe21fd1c235e0816066960f96240ecd5f2213adc5070c53694",
        s: "0x4bbeb002000d4c8c9a49f171e2cd368217d1555ad4fce563514f0243f6c24e3a",
      });
    });
  });
});
