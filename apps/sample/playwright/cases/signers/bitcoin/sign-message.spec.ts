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

interface SignMessageOutput {
  r: string;
  s: string;
  v: number;
}

test.describe("signer bitcoin: sign message", () => {
  test("signs a message approved on the device screen", async ({
    device,
    btcSigner,
    speculos,
  }) => {
    // Opening the Bitcoin app provisions a real Speculos instance and the
    // message must be reviewed on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Bitcoin app is connected", async () => {
      dev = await device.addAndConnect(NANO_X_WITH_BTC);
    });

    await test.step('When Sign message is executed for "Hello World"', async () => {
      await btcSigner.open();
      await btcSigner.signMessage();
    });

    await test.step("And the message is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 60_000 })
        .toContain("Review message");
      // Review message -> Path -> Message -> Sign message.
      await emulator.buttons().pressSequence(["right", "right", "right"]);
      await expect
        .poll(() => emulator.currentScreen())
        .toContain("Sign message");
      await emulator.buttons().both();
    });

    await test.step("Then the expected signature is returned", async () => {
      const result = await btcSigner.lastResult<SignMessageOutput>();

      expect(result.status).toBe("completed");
      // Deterministic (RFC 6979) for the fixed Speculos seed, 84'/0'/0' and
      // "Hello World". It recovers the 84'/0'/0' public key from the Bitcoin
      // signed message hash outside DMK.
      expect(result.output).toEqual({
        v: 32,
        r: "0x794d6463cc8a2783ee9c058b20e045e75471b9d1e1ec0164acd7d88da2b04699",
        s: "0x43a7111a206401d54271468f4396e357ff1f13aa7eb5c9f458bbde8af797d7d5",
      });
    });
  });
});
