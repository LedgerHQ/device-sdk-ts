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
    { name: "Tron", version: "0.5.0" },
  ],
  masks: [0x33200000],
};

interface GetAddressOutput {
  address: string;
  publicKey: string;
  chainCode?: string;
}

// A mainnet Tron address is a Base58Check string starting with "T" and 34
// characters long. The exact value is deterministic (fixed Speculos seed +
// path 44'/195'/0'/0/0), but we assert on the format to stay robust to the
// emulator's seed configuration.
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

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
      expect(result.output!.address).toMatch(TRON_ADDRESS_RE);
      expect(result.output!.publicKey).toMatch(/^[0-9a-fA-F]+$/);
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
      expect(result.output!.address).toMatch(TRON_ADDRESS_RE);
    });
  });
});
