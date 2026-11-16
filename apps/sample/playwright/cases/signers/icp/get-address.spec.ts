/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_ICP: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "InternetComputer", version: "4.2.7" },
  ],
  masks: [0x33200000],
};

interface GetAddressOutput {
  publicKey: string;
  accountId: string;
  principal: string;
}

// Deterministic: fixed Speculos seed (well-known test mnemonic) + derivation
// path 44'/223'/0'/0/0, derived with BIP-32 outside DMK. The principal is the
// self-authenticating principal of the DER-encoded public key; the account id
// is its default-subaccount identifier.
const EXPECTED_PUBLIC_KEY =
  "043b273b54cb2367952633bdc07a3a554d3bbdf91d0b42efd8b4c29c67671975f742301101f8c995187490e200d7645e6b7ece9d750a631b5771d1ad2cdeb4fa91";
const EXPECTED_PRINCIPAL =
  "35oyn-dalls-rpyzy-anovc-lvvw6-jnq65-iwssb-e5k2v-kbida-4qe6s-6ae";
const EXPECTED_ACCOUNT_ID =
  "5ad4babeaeec2b4e368f40105e9157c9e8eec6b0e46b5e03380ab726526ee140";

test.describe("signer icp: get address", () => {
  test("returns an address with default inputs (no options selected)", async ({
    device,
    icpSigner,
  }) => {
    // Opening the ICP app provisions a real Speculos instance, which can take
    // a while to become ready.
    test.setTimeout(120_000);

    await test.step("Given the device with the ICP app is connected", async () => {
      await device.addAndConnect(STAX_WITH_ICP);
    });

    await test.step("When Get address is executed with default inputs", async () => {
      await icpSigner.open();
      await icpSigner.getAddress();
    });

    await test.step("Then the ICP public key, principal and account id are returned", async () => {
      const result = await icpSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.publicKey).toBe(EXPECTED_PUBLIC_KEY);
      expect(result.output!.principal).toBe(EXPECTED_PRINCIPAL);
      expect(result.output!.accountId).toBe(EXPECTED_ACCOUNT_ID);
    });
  });

  test("validates the address on the device screen", async ({
    device,
    icpSigner,
    speculos,
  }) => {
    // Opening the ICP app provisions a real Speculos instance and the address
    // must be approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the ICP app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ICP);
    });

    await test.step("When Get address is executed with on-device verification", async () => {
      await icpSigner.open();
      await icpSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.approve();
    });

    await test.step("Then the ICP principal is returned", async () => {
      const result = await icpSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.principal).toBe(EXPECTED_PRINCIPAL);
    });
  });
});
