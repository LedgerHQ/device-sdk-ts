/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";
import { type AddressFormatLabel } from "../../../utils/drivers/BtcLegacySignerDriver";
import { type SpeculosDriver } from "../../../utils/drivers/SpeculosDriver";

const FLEX_WITH_LITECOIN: DeviceConfig = {
  name: "Ledger Flex",
  device_type: "flex",
  connectivity_type: "USB",
  firmware_version: "1.7.0",
  apps: [
    { name: "BOLOS", version: "1.7.0" },
    { name: "Litecoin", version: "2.4.13" },
  ],
  masks: [0x33300000],
};

const STAX_WITH_LITECOIN: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.11.0",
  apps: [
    { name: "BOLOS", version: "1.11.0" },
    { name: "Litecoin", version: "2.4.13" },
  ],
  masks: [0x33200000],
};

// The sample's default Get Address inputs: 84'/2'/0'/0/0, bech32.
const BECH32_ADDRESS = "ltc1q5r8yracmw27u74lev0he0zuz22tfd6dgdldnxe";

// Derived off-device from the mock server's default Speculos seed (BIP32 at
// each path, then Litecoin's base58 versions 0x30 / 0x32 and the `ltc` HRP),
// so the real app is checked against values it did not produce.
const SPECULOS_ADDRESSES: {
  format: AddressFormatLabel;
  derivationPath: string;
  address: string;
  publicKeyX: string;
  chainCode: string;
}[] = [
  {
    format: "Legacy",
    derivationPath: "44'/2'/0'/0/0",
    address: "LUU9uhjWSahYbtdyfa1jzJha8WKUTDbirk",
    publicKeyX:
      "49796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838",
    chainCode:
      "2334015491ccc5a7e7e15bab04f8a6c88ba0c7d33936658cf4f0178f6670e9b7",
  },
  {
    format: "P2SH",
    derivationPath: "49'/2'/0'/0/0",
    address: "MM4G2AXtLRYFr7fRNJaSzVXqBykdFfhVUT",
    publicKeyX:
      "86df4d8f350691dec03bb482e540e9ea0af6507733bf69216ced018bfe445e33",
    chainCode:
      "3a9857a598c2dc6893e5dc0b13a72fa80f1343b6622a4b261e511ef9000855b5",
  },
  {
    format: "Bech32",
    derivationPath: "84'/2'/0'/0/0",
    address: BECH32_ADDRESS,
    publicKeyX:
      "217a1a30898af08d4afc46cac681fc2b0a283d6c3ad9b09a7a27d2a2aaf9d336",
    chainCode:
      "5df04e87d504561a2555f2dbd01d6920cc4184ae85f1bf1bd416b6a1a2dcb232",
  },
];

interface GetAddressOutput {
  publicKey: string;
  address: string;
  chainCode: string;
}

// The app home screen renders first, so waiting for any screen is not enough:
// a tap there would land on "Quit app".
const waitForVerifyScreen = (emulator: SpeculosDriver) =>
  expect
    .poll(() => emulator.currentScreen(), { timeout: 30_000 })
    .toContain("Verify Litecoin address");

// Opening the Litecoin app provisions a real Speculos instance through the mock
// server, which alone waits up to 120s for the pod, so the budget is larger.
test.describe("signer litecoin: get address", () => {
  for (const {
    format,
    derivationPath,
    address,
    publicKeyX,
    chainCode,
  } of SPECULOS_ADDRESSES) {
    test(`returns the ${format} address from the Litecoin app`, async ({
      device,
      ltcSigner,
    }) => {
      test.setTimeout(180_000);

      await test.step("Given a connected Flex with the Litecoin app", async () => {
        await device.addAndConnect(FLEX_WITH_LITECOIN);
      });

      await test.step(`When Get Address is executed at ${derivationPath} with the ${format} format`, async () => {
        await ltcSigner.open();
        await ltcSigner.getAddress({ derivationPath, addressFormat: format });
      });

      await test.step("Then the address, public key and chain code of the Speculos seed are returned", async () => {
        const result = await ltcSigner.lastResult<GetAddressOutput>({
          timeout: 150_000,
        });

        expect(result.status).toBe("completed");
        expect(result.output!.address).toBe(address);
        // The sample renders byte arrays as 0x-prefixed hex. The app answers
        // with the uncompressed key: 04, then x, then y.
        expect(result.output!.publicKey).toMatch(
          new RegExp(`^0x04${publicKeyX}[0-9a-f]{64}$`),
        );
        expect(result.output!.chainCode).toBe(`0x${chainCode}`);
      });
    });
  }

  test("validates the address on the device screen", async ({
    device,
    ltcSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with the Litecoin app", async () => {
      dev = await device.addAndConnect(STAX_WITH_LITECOIN);
    });

    await test.step("When Get Address is executed with on-device verification", async () => {
      await ltcSigner.open();
      await ltcSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await waitForVerifyScreen(emulator);
      // Page 1 of 2 is "Verify Litecoin address / Swipe to continue"; page 2
      // shows the address and ends in a Confirm button, not a hold-to-sign.
      await emulator.touch().navigateNext();
      // The address wraps over several lines of the screen.
      await expect
        .poll(async () => (await emulator.currentScreen()).replace(/\s/g, ""), {
          timeout: 30_000,
        })
        .toContain(BECH32_ADDRESS);
      await emulator.attachScreenshot("confirm-address");
      await emulator.touch().mainButton();
    });

    await test.step("Then the address shown on the screen is returned", async () => {
      const result = await ltcSigner.lastResult<GetAddressOutput>({
        timeout: 150_000,
      });

      expect(result.status).toBe("completed");
      expect(result.output!.address).toBe(BECH32_ADDRESS);
    });
  });

  test("surfaces the app error when the address is rejected on the device", async ({
    device,
    ltcSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Flex with the Litecoin app", async () => {
      dev = await device.addAndConnect(FLEX_WITH_LITECOIN);
    });

    await test.step("When Get Address is executed with on-device verification", async () => {
      await ltcSigner.open();
      await ltcSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is cancelled on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await waitForVerifyScreen(emulator);
      await emulator.attachScreenshot("verify-address");
      // Cancel sits in the bottom-left cell of the footer.
      await emulator.touch().reject();
    });

    await test.step("Then the 6985 status word is surfaced as a legacy app error", async () => {
      const error = await ltcSigner.lastError({ timeout: 150_000 });

      expect(error).toContain("BtcLegacyAppCommandError");
      expect(error).toContain("errorCode: '6985'");
      expect(error).toContain("UserRejectedError");
    });
  });
});
