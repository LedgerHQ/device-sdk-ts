/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_TRX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Tron", version: "0.7.4" },
  ],
  masks: [0x33200000],
};

interface GetAddressOutput {
  address: string;
  publicKey: string;
  chainCode?: string;
}

// Deterministic: fixed Speculos seed (well-known test mnemonic) + derivation
// path 44'/195'/0'/0/0, derived with BIP-32 outside DMK.
const EXPECTED_ADDRESS = "TXQ69biZpJvofiNdai4jrehHTNkGPoUAdk";
const EXPECTED_PUBLIC_KEY =
  "0441bf179a21ed3af2bd108e5d190a90b32a216cce963445bd6df284a4f28699d5dfb929b0c8db99e5ee05260a9176449187576b792bcd2d5eb86f33524aca4d98";

test.describe("signer tron: get address", () => {
  test("returns an address with default inputs (no options selected)", async ({
    device,
    trxSigner,
  }) => {
    // Opening the Tron app provisions a real Speculos instance, which can take
    // a while to become ready.
    test.setTimeout(120_000);

    await test.step("Given the device with the Tron app is connected", async () => {
      await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Get address is executed with default inputs", async () => {
      await trxSigner.open();
      await trxSigner.getAddress();
    });

    await test.step("Then a valid Tron address is returned", async () => {
      const result = await trxSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.address).toBe(EXPECTED_ADDRESS);
      expect(result.output!.publicKey).toBe(EXPECTED_PUBLIC_KEY);
    });
  });

  test("validates the address on the device screen", async ({
    device,
    trxSigner,
    speculos,
  }) => {
    // Opening the Tron app provisions a real Speculos instance and the address
    // must be approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Tron app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Get address is executed with on-device verification", async () => {
      await trxSigner.open();
      await trxSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approve();
    });

    await test.step("Then a valid Tron address is returned", async () => {
      const result = await trxSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.address).toBe(EXPECTED_ADDRESS);
    });
  });
});
