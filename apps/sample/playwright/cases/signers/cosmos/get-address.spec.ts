import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X_WITH_COSMOS: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.8.0",
  apps: [
    { name: "BOLOS", version: "2.8.0" },
    { name: "Cosmos", version: "2.39.3" },
  ],
  masks: [0x33000000],
};

interface GetAddressOutput {
  publicKey: string;
  address: string;
}

test.describe("signer cosmos: get address", () => {
  test("returns the address for the default derivation path", async ({
    device,
    cosmosSigner,
  }) => {
    // Opening the Cosmos app provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given the device with the Cosmos app is connected", async () => {
      await device.addAndConnect(NANO_X_WITH_COSMOS);
    });

    await test.step("When Get Address is executed with default inputs", async () => {
      await cosmosSigner.open();
      await cosmosSigner.getAddress();
    });

    await test.step("Then the expected Cosmos address is returned", async () => {
      const result = await cosmosSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      // Deterministic: fixed Speculos seed + 44'/118'/0'/0/0, derived with
      // BIP-32 and bech32 outside DMK.
      expect(result.output).toEqual({
        publicKey:
          "0x03f2a94e50007f851abcc7592a4af5708395e85ac3507f5233daf8cec6053c02b2",
        address: "cosmos15t2rdzfujh632kvgsdvlwxux84h4lnf5hc8x0x",
      });
    });
  });
});
