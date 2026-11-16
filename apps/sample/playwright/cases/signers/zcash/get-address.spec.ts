import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X_WITH_ZCASH: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.8.0",
  apps: [
    { name: "BOLOS", version: "2.8.0" },
    { name: "Zcash", version: "3.9.4" },
  ],
  masks: [0x33000000],
};

interface GetAddressOutput {
  publicKey: string;
  address: string;
  chainCode?: string;
}

test.describe("signer zcash: get address", () => {
  test("returns the transparent address of 44'/133'/0'/0/0", async ({
    device,
    zcashSigner,
  }) => {
    // Opening the Zcash app provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given the device with the Zcash app is connected", async () => {
      await device.addAndConnect(NANO_X_WITH_ZCASH);
    });

    await test.step("When Get Address is executed for 44'/133'/0'/0/0", async () => {
      await zcashSigner.open();
      await zcashSigner.getAddress("44'/133'/0'/0/0");
    });

    await test.step("Then the expected transparent address is returned", async () => {
      const result = await zcashSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      // Deterministic: fixed Speculos seed + 44'/133'/0'/0/0, derived with
      // BIP-32 and base58check (t1 prefix 1cb8) outside DMK.
      expect(result.output).toEqual({
        publicKey:
          "0x0441b8182fc9f39b15a06c76795d91fd4c1616e225da3fa600b674d5d61d11bc1419a1c21698fbcc8a5e9abe94c30b8b8df47bd1f6129c9b923a3ee50ebcd4932c",
        address: "t1dviNAkzkKxtWkKZy8cmtDxMkwX7jNk9fH",
        chainCode:
          "0x741a815ef2059365801746f5cb5b258e3b0c65b6a3a6260cd14db3dbc551c9c4",
      });
    });
  });
});
