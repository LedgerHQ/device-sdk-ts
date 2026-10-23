/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

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

// Previous transactions paying the mock server's default Speculos seed: 50 LTC
// to 44'/2'/0'/0/0 at output 1 of A, and 30 LTC to 44'/2'/0'/0/1 at output 0
// of B, whose inputs carry 107-byte scripts.
const PREVIOUS_A =
  "0100000001423d1f6109a7d9173c218e7bdf5e2a9867c1ad07ee59c5eb1c204da052a0d9db000000006b480f531200a5ce6e67686b3e62f4a1faa3530ba0e12030eed116cdd8c790de4881eac6a223647223afd5b3bcdd4f587177229154ed44af5f3b6bde41864af3910b7995bff7b9ad05bf21021e339148aa57c4d4ccce6e3a0e403817ad1fee0270aaa99367348d3ee807b03effffffff0240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac0065cd1d000000001976a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88ac00000000";
const PREVIOUS_B =
  "010000000233c0b92c6b10670a320bdfe3c7680954d0c898a170b62006d46f3626cddb192f000000006b48c1b83ed717b52ccbd5f07692ac037ab8b01c1863c3a04961f1045155b4d872bec00d51a0505965f176e45436c5ce77d29cdad6a9bf1c725de58b21103f4530873a40aa41e688006c21024b78b966d5b24e1fd4030ccc4b6d1beb386e3d42a8da87a6e59987beef20559efffffffff2d14d2b793ae4bb10874528fdea19b234ddf0f201905b15046dd485caec3fd7010000006b48484283215a94cc09c95f2163c4a6b6b36d46491341701aadb4c66f85dd24284d81b12f091ff8955f3f9654d517a6214674e2ddded52cf6d1cdd65e1d5edeb16b37e58cd12707a0c521023775a91b1886bd913210743a179a2acb9b3ecefdd366c424a4627928846444aeffffffff0100a3e111000000001976a91436de3aa1522b2ba361430ff35b2b8da0a174332d88aca0252600";

// The expected transactions are the ones hw-app-btc's createTransaction signs
// for the same arguments on the Litecoin app. The app signs ECDSA
// deterministically (RFC 6979), so the bytes match exactly.
const TRANSACTIONS = [
  {
    name: "one input and one output",
    fields: {
      inputs: `${PREVIOUS_A}:1`,
      associatedKeysets: "44'/2'/0'/0/0",
      outputScriptHex:
        "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
    },
    signedTransaction:
      "0x0100000001e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000006a473044022070cf3362850ecf3ecec3dbb4a027172c220ede403e87a24b9bcc5cfec54ec4c60220799dfb3cd82fc6a6111cb4da6493d1bacc295d504a769d5c512035dcdf83e00a01210249796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838ffffffff01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
  {
    name: "two inputs, a change output, a lock time and RBF sequences",
    fields: {
      inputs: `${PREVIOUS_A}:1:4294967293, ${PREVIOUS_B}:0:4294967293`,
      associatedKeysets: "44'/2'/0'/0/0, 44'/2'/0'/0/1",
      changePath: "44'/2'/0'/1/0",
      outputScriptHex:
        "020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a914280cd281f64388bda5b7e6c7c620204c9dd2d30d88ac",
      lockTime: "2800000",
    },
    signedTransaction:
      "0x0100000002e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000006b483045022100bfe99fe8773f40a2839cbfbbb1aa15bfe08a6af371ce5b0f494a89be7b27167702201b48366220a65911d569da0d2a0143388eb5b04580226999a3de57fdd1d2eefd01210249796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838fdffffff31940ae05eaf626f55310c6ffee6a5145c2b80ff61fa29cd2a94fd6156207e4b000000006a47304402207d390c05460ee7ffde3dafaa8d398b1e9d943be34c7fcb9c1a507e96cc4784c402202114dfeb039be93e16f19f635438f0330abdb1d15841d8bf8234244c6e1cd500012103f7455a5a3072e29808c3772d63a1c42ac9ca1a8e04718fdb9318d92d680caea8fdffffff020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a914280cd281f64388bda5b7e6c7c620204c9dd2d30d88ac80b92a00",
  },
];

// Opening the Litecoin app provisions a real Speculos instance through the mock
// server, which alone waits up to 120s for the pod, so the budget is larger.
test.describe("signer litecoin: sign transaction", () => {
  for (const { name, fields, signedTransaction } of TRANSACTIONS) {
    test(`signs a transaction with ${name}`, async ({
      device,
      ltcSigner,
      speculos,
    }) => {
      test.setTimeout(240_000);

      let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

      await test.step("Given a connected Flex with the Litecoin app", async () => {
        dev = await device.addAndConnect(FLEX_WITH_LITECOIN);
      });

      await test.step("When the transaction is submitted for signing", async () => {
        await ltcSigner.open();
        await ltcSigner.signTransaction(fields);
      });

      await test.step("And the transaction is approved on the Speculos screen", async () => {
        const emulator = speculos(dev);
        await emulator.waitReady();
        await emulator.approveSigning();
      });

      await test.step("Then hw-app-btc's signed transaction is returned", async () => {
        const result = await ltcSigner.lastResult<string>({
          timeout: 150_000,
        });

        expect(result.status).toBe("completed");
        expect(result.output).toBe(signedTransaction);
      });
    });
  }

  test("surfaces the app error when the transaction is rejected", async ({
    device,
    ltcSigner,
    speculos,
  }) => {
    test.setTimeout(240_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Flex with the Litecoin app", async () => {
      dev = await device.addAndConnect(FLEX_WITH_LITECOIN);
    });

    await test.step("When the transaction is submitted for signing", async () => {
      await ltcSigner.open();
      await ltcSigner.signTransaction(TRANSACTIONS[0]!.fields);
    });

    await test.step("And the transaction is rejected on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      // The home screen shows first, where the reject spot is "Quit app".
      await expect
        .poll(() => emulator.currentScreen(), { timeout: 60_000 })
        .toContain("Review transaction");
      // Rejecting takes two taps: "Reject" on the review, then "Yes, reject"
      // on the confirmation it opens.
      await emulator.touch().reject();
      await new Promise((r) => setTimeout(r, 1500));
      await emulator.touch().mainButton();
    });

    await test.step("Then the rejection is surfaced as an app error", async () => {
      const error = await ltcSigner.lastError({ timeout: 150_000 });

      expect(error).toContain("BtcLegacyAppCommandError");
      expect(error).toContain("errorCode: '6985'");
    });
  });
});
