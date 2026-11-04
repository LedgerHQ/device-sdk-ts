/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

/**
 * V2 is selected on app version alone, so the app pinned here is what decides
 * whether the signer streams V1 or delivers the two V2 TLV payloads.
 */
const STAX_WITH_ETH_V2: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Ethereum", version: "1.23.0" },
  ],
  masks: [0x33200000],
};

// Nested struct, an array of structs and a jagged dynamic array: the shapes V2
// addresses by position rather than by path.
const TYPED_MESSAGE = JSON.stringify({
  domain: {
    name: "Ether Mail",
    version: "1",
    chainId: 1,
    verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  },
  primaryType: "Mail",
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Person: [
      { name: "name", type: "string" },
      { name: "wallets", type: "address[]" },
    ],
    Mail: [
      { name: "from", type: "Person" },
      { name: "to", type: "Person[]" },
      { name: "contents", type: "string" },
    ],
  },
  message: {
    from: {
      name: "Cow",
      wallets: [
        "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
        "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
      ],
    },
    to: [
      { name: "Bob", wallets: ["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"] },
    ],
    contents: "Hello, Bob!",
  },
});

interface SignTypedDataOutput {
  r: string;
  s: string;
  v: number;
}

test.describe("signer ethereum: sign typed message (EIP-712 V2)", () => {
  test("signs an EIP-712 message through the V2 protocol", async ({
    page,
    device,
    ethSigner,
    speculos,
  }) => {
    // Speculos needs an Ethereum 1.23.0 ELF, which the catalogue only carries
    // once V2 ships. Drop this line then.
    test.fixme(
      true,
      "Needs an Ethereum app release that implements EIP-712 V2",
    );

    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with an EIP-712 V2 capable app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH_V2);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      // V2 has no field descriptors yet, so every value is displayed raw.
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign typed message is executed", async () => {
      await ethSigner.open();
      await ethSigner.signTypedMessage(TYPED_MESSAGE);
    });

    await test.step("And the message is approved on the Speculos screen", async () => {
      await emulator.approveSigning();
    });

    await test.step("Then a valid signature is returned", async () => {
      const result = await ethSigner.lastResult<SignTypedDataOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.r).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.output!.s).toMatch(/^0x[0-9a-f]{64}$/);
      expect(typeof result.output!.v).toBe("number");
    });

    await test.step("And the V2 protocol was used, not V1", async () => {
      await expect(
        page.getByTestId("box_device-commands-responses"),
      ).toContainText("signer.eth.steps.signTypedDataV2");
    });
  });
});
