import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X_WITH_POLKADOT: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.8.0",
  apps: [
    { name: "BOLOS", version: "2.8.0" },
    { name: "Polkadot", version: "100.0.30" },
  ],
  masks: [0x33000000],
};

interface GetAddressOutput {
  publicKey: string;
  address: string;
}

test.describe("signer polkadot: get address", () => {
  test("returns the address for the default derivation path", async ({
    device,
    polkadotSigner,
  }) => {
    // Opening the Polkadot app provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given the device with the Polkadot app is connected", async () => {
      await device.addAndConnect(NANO_X_WITH_POLKADOT);
    });

    await test.step("When Get Address is executed with default inputs", async () => {
      await polkadotSigner.open();
      await polkadotSigner.getAddress();
    });

    await test.step("Then the expected Polkadot address is returned", async () => {
      const result = await polkadotSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      // Recorded from the app for the fixed Speculos seed and
      // 44'/354'/0'/0'/0'. The address is the SS58 (prefix 0) encoding of the
      // public key, checked outside DMK.
      expect(result.output).toEqual({
        publicKey:
          "0x0af36376b90685fad206fab10ad307e7333035e14f2b4cab5c7d8eb4846d1d84",
        address: "1FMnG5EEmBNbdvPvyNTttuQeMpKjYYV2CBivK8EZPaGzHxZ",
      });
    });
  });
});
