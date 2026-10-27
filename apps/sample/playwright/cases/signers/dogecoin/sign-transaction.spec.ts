/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const FLEX_WITH_DOGECOIN: DeviceConfig = {
  name: "Ledger Flex",
  device_type: "flex",
  connectivity_type: "USB",
  firmware_version: "1.7.0",
  apps: [
    { name: "BOLOS", version: "1.7.0" },
    { name: "Dogecoin", version: "2.4.13" },
  ],
  masks: [0x33300000],
};

// Previous transactions paying the mock server's default Speculos seed: 5,000
// DOGE to 44'/3'/0'/0/0 at output 1 of A, and 3,000 DOGE to 44'/3'/0'/0/1 at
// output 0 of B, whose inputs carry 107-byte scripts.
const PREVIOUS_A =
  "0100000001eaa8d810c854b9a614cc52aa9ee0e0c99fdd31ac086a0e61041f0007b7e44430000000006b48cf81c68923784e6e33d1a8f559a8ad75a3952dec6f577c2f9abb0ffe07ae2cf54983e718f733716188ac89ca51dcb3649f245bb31ec0548f2d5ae8d193c7294a3f0a0f56bd615c5621026024f7fc94cc49426df9687f8c146eb04464f3e3d3fa867e408a68738a2a8a1bffffffff0280588d49000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00f2052a010000001976a9144fb4f23b006689f3fef238ab8305899250ab750b88ac00000000";
const PREVIOUS_B =
  "0100000002878acc0210703f9032608b18babfe8f4c5cfaf30d7ee37ccef2a46db45f0eb38000000006b487e925cb14024fb90de872664da55bf102eeca16fdba727c41440aebbc1496dae8dc018335d51674fd7890198449838199c1469ed520b971d9329391b0482991d1971541346d59b5b2102b353d504fadc1d1da38ad73d23b96cd437d1f8f44c930c90319d694e7af5cc5bffffffff142dc509c4d8f7f570debc58454c4a268ecd42e76abb7656714d7ab23e12839d010000006b4821db5885203691b069c623844d067ab2af096c4be04c7d79acebae2515450663e17490ebe4e7a74a45827797712805255df9084a3dd3680d404a678494f3a5bd2a815d389e67c98a2102e7ec75cb11bc5e9bb7cea6aa90d7b262ed6c4c5506862bc007659c11eeeeb767ffffffff01005ed0b2000000001976a914b26e3063d8c7713accce19455e628c2ece20e3a488aca0252600";

// The expected transactions are the ones hw-app-btc's createTransaction signs
// for the same arguments on the Dogecoin app. The app signs ECDSA
// deterministically (RFC 6979), so the bytes match exactly.
const TRANSACTIONS = [
  {
    name: "one input and one output",
    fields: {
      inputs: `${PREVIOUS_A}:1`,
      associatedKeysets: "44'/3'/0'/0/0",
      outputScriptHex:
        "01805b6d29010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
    },
    signedTransaction:
      "0x0100000001c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed6683010000006a47304402206d2c8bc536e79945faeb5197f3aec4afd57bc158ff1585c1b3cbd38f9617a5da02207c30ea9450bf4aeb1e6fdc9a0b39b042cac7925aab0a750f2d48157df9f0865a0121024d924f6587fcf74f7ca08771cd8eebddeb314f488d17070f2dcc13f96969aa57ffffffff01805b6d29010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
  {
    name: "two inputs, a change output, a lock time and RBF sequences",
    fields: {
      inputs: `${PREVIOUS_A}:1:4294967293, ${PREVIOUS_B}:0:4294967293`,
      associatedKeysets: "44'/3'/0'/0/0, 44'/3'/0'/0/1",
      changePath: "44'/3'/0'/1/0",
      outputScriptHex:
        "0200bca065010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00670476000000001976a914e912b4fbdb8986cda0e790a4f10dddf364f1b17988ac",
      lockTime: "2800000",
    },
    signedTransaction:
      "0x0100000002c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed6683010000006a47304402204771767ed42c001a36be5662ee37f3ead8d394bc9d1ddf0d3194455b24f2dba302204d6e2c6ff43c49c84af7fb7ba1d795392c9501405ff4bb6a9828e937d7bc4f4d0121024d924f6587fcf74f7ca08771cd8eebddeb314f488d17070f2dcc13f96969aa57fdffffff78282b7c31e2da482ac3b88a44b1d7b85cfdc89dff5049447994b87e7fd0e5ca000000006a47304402207f5714ac7eb6c7f0fe2921de37009a8d22a5d67cf9f5d88c7abe7904c39b05c90220427a4a1dabc405aa41b62f4a15c375b3905f42e41217993e98ec8030fbbe5fc30121024c77b70334dc101e4a071ef1d115f9dbe97630ad441117b881a27aa498f23a00fdffffff0200bca065010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00670476000000001976a914e912b4fbdb8986cda0e790a4f10dddf364f1b17988ac80b92a00",
  },
];

// Opening the Dogecoin app provisions a real Speculos instance through the mock
// server, which alone waits up to 120s for the pod, so the budget is larger.
test.describe("signer dogecoin: sign transaction", () => {
  for (const { name, fields, signedTransaction } of TRANSACTIONS) {
    test(`signs a transaction with ${name}`, async ({
      device,
      dogeSigner,
      speculos,
    }) => {
      test.setTimeout(240_000);

      let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

      await test.step("Given a connected Flex with the Dogecoin app", async () => {
        dev = await device.addAndConnect(FLEX_WITH_DOGECOIN);
      });

      await test.step("When the transaction is submitted for signing", async () => {
        await dogeSigner.open();
        await dogeSigner.signTransaction(fields);
      });

      await test.step("And the transaction is approved on the Speculos screen", async () => {
        const emulator = speculos(dev);
        await emulator.waitReady();
        await emulator.approveSigning();
      });

      await test.step("Then hw-app-btc's signed transaction is returned", async () => {
        const result = await dogeSigner.lastResult<string>({
          timeout: 150_000,
        });

        expect(result.status).toBe("completed");
        expect(result.output).toBe(signedTransaction);
      });
    });
  }

  test("surfaces the app error when the transaction is rejected", async ({
    device,
    dogeSigner,
    speculos,
  }) => {
    test.setTimeout(240_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Flex with the Dogecoin app", async () => {
      dev = await device.addAndConnect(FLEX_WITH_DOGECOIN);
    });

    await test.step("When the transaction is submitted for signing", async () => {
      await dogeSigner.open();
      await dogeSigner.signTransaction(TRANSACTIONS[0]!.fields);
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
      const error = await dogeSigner.lastError({ timeout: 150_000 });

      expect(error).toContain("BtcLegacyAppCommandError");
      expect(error).toContain("errorCode: '6985'");
    });
  });
});
