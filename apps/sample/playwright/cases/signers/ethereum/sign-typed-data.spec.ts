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

// A standard EIP-712 Permit message. Without a clear-signing context (none in
// the mock environment), the app routes it through blind signing.
const TYPED_MESSAGE = JSON.stringify({
  domain: {
    name: "USD Coin",
    verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    chainId: 1,
    version: "2",
  },
  primaryType: "Permit",
  message: {
    deadline: 1718992051,
    nonce: 0,
    spender: "0x111111125421ca6dc452d289314280a0f8842a65",
    owner: "0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d",
    value:
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
  },
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
});

interface SignTypedDataOutput {
  r: string;
  s: string;
  v: number;
}

test.describe("signer ethereum: sign typed message", () => {
  test("signs an EIP-712 message approved on the device screen", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    // Opening the Ethereum app provisions a real Speculos instance and the
    // message must be reviewed/approved on screen, so this flow is slow.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Ethereum app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH);
    });

    const emulator = speculos(dev);
    await test.step("And blind signing is enabled on the device", async () => {
      // Open the app first (via Get address) so its settings are reachable, then
      // enable blind signing — the EIP-712 message has no clear-signing context.
      await ethSigner.open();
      await ethSigner.getAddress();
      await ethSigner.lastResult();
      await emulator.waitReady();
      await emulator.enableBlindSigning();
    });

    await test.step("When Sign typed message is executed", async () => {
      // Re-open the Ethereum signer to return from the Get address tester to the
      // action list (selecting an action replaces the list).
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
  });
});
