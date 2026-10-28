import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { BITCOIN_CASH_PROFILE } from "@api/profiles/bitcoinCashProfile";
import { BITCOIN_GOLD_PROFILE } from "@api/profiles/bitcoinGoldProfile";
import { DOGECOIN_PROFILE } from "@api/profiles/dogecoinProfile";
import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { type BtcLegacyErrorCodes } from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

/**
 * Transactions signed by hw-app-btc's `createTransaction` (ledger-live
 * dd044b36c83, the legacy path Ledger Wallet takes for these coins) on the
 * coin apps of a Nano S Plus 1.7.0 from Speculinho, with the default Speculos
 * seed. Each exchange is an APDU hw-app-btc sent and the app's answer, without
 * its first one, get app and version (b001), which only picks the SegWit
 * trusted input mode. The previous transactions pay the seed and are parsed by
 * hw-app-btc's `splitTransaction`.
 */
export const REFERENCE_TRANSACTIONS: {
  name: string;
  profile: LegacyCoinProfile<BtcLegacyErrorCodes>;
  transaction: LegacyCreateTransactionArg;
  exchanges: [apdu: string, response: string][];
  signedTransaction: string;
}[] = [
  {
    name: "Litecoin: one input, one output",
    profile: LITECOIN_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "423d1f6109a7d9173c218e7bdf5e2a9867c1ad07ee59c5eb1c204da052a0d9db00000000",
                )!,
                script: hexaStringToBuffer(
                  "480f531200a5ce6e67686b3e62f4a1faa3530ba0e12030eed116cdd8c790de4881eac6a223647223afd5b3bcdd4f587177229154ed44af5f3b6bde41864af3910b7995bff7b9ad05bf21021e339148aa57c4d4ccce6e3a0e403817ad1fee0270aaa99367348d3ee807b03e",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          null,
        ],
      ],
      associatedKeysets: ["44'/2'/0'/0/0"],
      outputScriptHex:
        "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025423d1f6109a7d9173c218e7bdf5e2a9867c1ad07ee59c5eb1c204da052a0d9db000000006b",
        "9000",
      ],
      [
        "e042800032480f531200a5ce6e67686b3e62f4a1faa3530ba0e12030eed116cdd8c790de4881eac6a223647223afd5b3bcdd4f58717722",
        "9000",
      ],
      [
        "e0428000329154ed44af5f3b6bde41864af3910b7995bff7b9ad05bf21021e339148aa57c4d4ccce6e3a0e403817ad1fee0270aaa99367",
        "9000",
      ],
      ["e04280000b348d3ee807b03effffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "32007507e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000000065cd1d00000000d943b6735c40cc419000",
      ],
      [
        "e040000015058000002c80000002800000000000000000000000",
        "410449796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838ca59529ce201fd3fa7d546a9a63de5a3838f6d273b08ab3bed78b9cdaa15d0de224c55553975686a5753616859627464796661316a7a4a686138574b5554446269726b2334015491ccc5a7e7e15bab04f8a6c88ba0c7d33936658cf4f0178f6670e9b79000",
      ],
      ["e0440000050100000001", "9000"],
      [
        "e04480003b013832007507e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000000065cd1d00000000d943b6735c40cc4119",
        "9000",
      ],
      [
        "e04480001d76a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88acffffffff",
        "9000",
      ],
      [
        "e04a80002301c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "00009000",
      ],
      [
        "e04800001b058000002c80000002800000000000000000000000000000000001",
        "3144022070cf3362850ecf3ecec3dbb4a027172c220ede403e87a24b9bcc5cfec54ec4c60220799dfb3cd82fc6a6111cb4da6493d1bacc295d504a769d5c512035dcdf83e00a019000",
      ],
    ],
    signedTransaction:
      "0x0100000001e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000006a473044022070cf3362850ecf3ecec3dbb4a027172c220ede403e87a24b9bcc5cfec54ec4c60220799dfb3cd82fc6a6111cb4da6493d1bacc295d504a769d5c512035dcdf83e00a01210249796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838ffffffff01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
  {
    name: "Litecoin: two inputs, change, lock time and RBF sequences",
    profile: LITECOIN_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "423d1f6109a7d9173c218e7bdf5e2a9867c1ad07ee59c5eb1c204da052a0d9db00000000",
                )!,
                script: hexaStringToBuffer(
                  "480f531200a5ce6e67686b3e62f4a1faa3530ba0e12030eed116cdd8c790de4881eac6a223647223afd5b3bcdd4f587177229154ed44af5f3b6bde41864af3910b7995bff7b9ad05bf21021e339148aa57c4d4ccce6e3a0e403817ad1fee0270aaa99367348d3ee807b03e",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          4294967293,
        ],
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "33c0b92c6b10670a320bdfe3c7680954d0c898a170b62006d46f3626cddb192f00000000",
                )!,
                script: hexaStringToBuffer(
                  "48c1b83ed717b52ccbd5f07692ac037ab8b01c1863c3a04961f1045155b4d872bec00d51a0505965f176e45436c5ce77d29cdad6a9bf1c725de58b21103f4530873a40aa41e688006c21024b78b966d5b24e1fd4030ccc4b6d1beb386e3d42a8da87a6e59987beef20559e",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
              {
                prevout: hexaStringToBuffer(
                  "f2d14d2b793ae4bb10874528fdea19b234ddf0f201905b15046dd485caec3fd701000000",
                )!,
                script: hexaStringToBuffer(
                  "48484283215a94cc09c95f2163c4a6b6b36d46491341701aadb4c66f85dd24284d81b12f091ff8955f3f9654d517a6214674e2ddded52cf6d1cdd65e1d5edeb16b37e58cd12707a0c521023775a91b1886bd913210743a179a2acb9b3ecefdd366c424a4627928846444ae",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("00a3e11100000000")!,
                script: hexaStringToBuffer(
                  "76a91436de3aa1522b2ba361430ff35b2b8da0a174332d88ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("a0252600")!,
          },
          0,
          null,
          4294967293,
        ],
      ],
      associatedKeysets: ["44'/2'/0'/0/0", "44'/2'/0'/0/1"],
      changePath: "44'/2'/0'/1/0",
      outputScriptHex:
        "020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a914280cd281f64388bda5b7e6c7c620204c9dd2d30d88ac",
      lockTime: 2800000,
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025423d1f6109a7d9173c218e7bdf5e2a9867c1ad07ee59c5eb1c204da052a0d9db000000006b",
        "9000",
      ],
      [
        "e042800032480f531200a5ce6e67686b3e62f4a1faa3530ba0e12030eed116cdd8c790de4881eac6a223647223afd5b3bcdd4f58717722",
        "9000",
      ],
      [
        "e0428000329154ed44af5f3b6bde41864af3910b7995bff7b9ad05bf21021e339148aa57c4d4ccce6e3a0e403817ad1fee0270aaa99367",
        "9000",
      ],
      ["e04280000b348d3ee807b03effffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "32000003e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000000065cd1d00000000420ff7ee81de70ab9000",
      ],
      ["e042000009000000000100000002", "9000"],
      [
        "e04280002533c0b92c6b10670a320bdfe3c7680954d0c898a170b62006d46f3626cddb192f000000006b",
        "9000",
      ],
      [
        "e04280003248c1b83ed717b52ccbd5f07692ac037ab8b01c1863c3a04961f1045155b4d872bec00d51a0505965f176e45436c5ce77d29c",
        "9000",
      ],
      [
        "e042800032dad6a9bf1c725de58b21103f4530873a40aa41e688006c21024b78b966d5b24e1fd4030ccc4b6d1beb386e3d42a8da87a6e5",
        "9000",
      ],
      ["e04280000b9987beef20559effffffff", "9000"],
      [
        "e042800025f2d14d2b793ae4bb10874528fdea19b234ddf0f201905b15046dd485caec3fd7010000006b",
        "9000",
      ],
      [
        "e04280003248484283215a94cc09c95f2163c4a6b6b36d46491341701aadb4c66f85dd24284d81b12f091ff8955f3f9654d517a6214674",
        "9000",
      ],
      [
        "e042800032e2ddded52cf6d1cdd65e1d5edeb16b37e58cd12707a0c521023775a91b1886bd913210743a179a2acb9b3ecefdd366c424a4",
        "9000",
      ],
      ["e04280000b627928846444aeffffffff", "9000"],
      ["e04280000101", "9000"],
      [
        "e04280002200a3e111000000001976a91436de3aa1522b2ba361430ff35b2b8da0a174332d88ac",
        "9000",
      ],
      [
        "e042800004a0252600",
        "320096b931940ae05eaf626f55310c6ffee6a5145c2b80ff61fa29cd2a94fd6156207e4b0000000000a3e1110000000097ad6d7406c37aa19000",
      ],
      [
        "e040000015058000002c80000002800000000000000000000000",
        "410449796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838ca59529ce201fd3fa7d546a9a63de5a3838f6d273b08ab3bed78b9cdaa15d0de224c55553975686a5753616859627464796661316a7a4a686138574b5554446269726b2334015491ccc5a7e7e15bab04f8a6c88ba0c7d33936658cf4f0178f6670e9b79000",
      ],
      [
        "e040000015058000002c80000002800000000000000000000001",
        "4104f7455a5a3072e29808c3772d63a1c42ac9ca1a8e04718fdb9318d92d680caea8525e6a9683d3c54b8a90c7e6c383a2ef57c06988b9b43948494c021a4b27f88b224c514534794b455066565a39504161635452317248467833757943416e5439434468077c0cc016fffec04f2c9fe1394b0bcc31049b0baaede7dab06b772d3a43d8ea9000",
      ],
      ["e0440000050100000002", "9000"],
      [
        "e04480003b013832000003e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000000065cd1d00000000420ff7ee81de70ab19",
        "9000",
      ],
      [
        "e04480001d76a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88acfdffffff",
        "9000",
      ],
      [
        "e04480003b0138320096b931940ae05eaf626f55310c6ffee6a5145c2b80ff61fa29cd2a94fd6156207e4b0000000000a3e1110000000097ad6d7406c37aa100",
        "9000",
      ],
      ["e044800004fdffffff", "9000"],
      ["e04aff0015058000002c80000002800000000000000100000000", "9000"],
      [
        "e04a000032020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a914280cd2",
        "009000",
      ],
      ["e04a80001381f64388bda5b7e6c7c620204c9dd2d30d88ac", "00009000"],
      [
        "e04800001b058000002c8000000280000000000000000000000000002ab98001",
        "3045022100bfe99fe8773f40a2839cbfbbb1aa15bfe08a6af371ce5b0f494a89be7b27167702201b48366220a65911d569da0d2a0143388eb5b04580226999a3de57fdd1d2eefd019000",
      ],
      ["e0440080050100000002", "9000"],
      [
        "e04480803b013832000003e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000000065cd1d00000000420ff7ee81de70ab00",
        "9000",
      ],
      ["e044808004fdffffff", "9000"],
      [
        "e04480803b0138320096b931940ae05eaf626f55310c6ffee6a5145c2b80ff61fa29cd2a94fd6156207e4b0000000000a3e1110000000097ad6d7406c37aa119",
        "9000",
      ],
      [
        "e04480801d76a91436de3aa1522b2ba361430ff35b2b8da0a174332d88acfdffffff",
        "9000",
      ],
      ["e04aff0015058000002c80000002800000000000000100000000", "9000"],
      [
        "e04a000032020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a914280cd2",
        "009000",
      ],
      ["e04a80001381f64388bda5b7e6c7c620204c9dd2d30d88ac", "00009000"],
      [
        "e04800001b058000002c8000000280000000000000000000000100002ab98001",
        "304402207d390c05460ee7ffde3dafaa8d398b1e9d943be34c7fcb9c1a507e96cc4784c402202114dfeb039be93e16f19f635438f0330abdb1d15841d8bf8234244c6e1cd500019000",
      ],
    ],
    signedTransaction:
      "0x0100000002e9a6d6e08286bdb7603613b09d569dbd0132f63999d2030d4f622a9501b05146010000006b483045022100bfe99fe8773f40a2839cbfbbb1aa15bfe08a6af371ce5b0f494a89be7b27167702201b48366220a65911d569da0d2a0143388eb5b04580226999a3de57fdd1d2eefd01210249796ae00817bdc4110ef52ca47bef19ce4434981ed286cd30ab65867251b838fdffffff31940ae05eaf626f55310c6ffee6a5145c2b80ff61fa29cd2a94fd6156207e4b000000006a47304402207d390c05460ee7ffde3dafaa8d398b1e9d943be34c7fcb9c1a507e96cc4784c402202114dfeb039be93e16f19f635438f0330abdb1d15841d8bf8234244c6e1cd500012103f7455a5a3072e29808c3772d63a1c42ac9ca1a8e04718fdb9318d92d680caea8fdffffff020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a914280cd281f64388bda5b7e6c7c620204c9dd2d30d88ac80b92a00",
  },
  {
    name: "Dogecoin: one input, one output",
    profile: DOGECOIN_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "eaa8d810c854b9a614cc52aa9ee0e0c99fdd31ac086a0e61041f0007b7e4443000000000",
                )!,
                script: hexaStringToBuffer(
                  "48cf81c68923784e6e33d1a8f559a8ad75a3952dec6f577c2f9abb0ffe07ae2cf54983e718f733716188ac89ca51dcb3649f245bb31ec0548f2d5ae8d193c7294a3f0a0f56bd615c5621026024f7fc94cc49426df9687f8c146eb04464f3e3d3fa867e408a68738a2a8a1b",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("80588d4900000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("00f2052a01000000")!,
                script: hexaStringToBuffer(
                  "76a9144fb4f23b006689f3fef238ab8305899250ab750b88ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          null,
        ],
      ],
      associatedKeysets: ["44'/3'/0'/0/0"],
      outputScriptHex:
        "01805b6d29010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025eaa8d810c854b9a614cc52aa9ee0e0c99fdd31ac086a0e61041f0007b7e44430000000006b",
        "9000",
      ],
      [
        "e04280003248cf81c68923784e6e33d1a8f559a8ad75a3952dec6f577c2f9abb0ffe07ae2cf54983e718f733716188ac89ca51dcb3649f",
        "9000",
      ],
      [
        "e042800032245bb31ec0548f2d5ae8d193c7294a3f0a0f56bd615c5621026024f7fc94cc49426df9687f8c146eb04464f3e3d3fa867e40",
        "9000",
      ],
      ["e04280000b8a68738a2a8a1bffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002280588d49000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e04280002200f2052a010000001976a9144fb4f23b006689f3fef238ab8305899250ab750b88ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "32001400c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed66830100000000f2052a0100000020a1a0159d58cc4f9000",
      ],
      [
        "e040000015058000002c80000003800000000000000000000000",
        "41044d924f6587fcf74f7ca08771cd8eebddeb314f488d17070f2dcc13f96969aa57d20fd9b2ee6f16510ca190ce41833ec573abc63c2bd8d10b40170db6ee9362ea2244435159676d796e4258504b6162503757576238594d355232713334685378775746aac765706e1e25078a4aa98726f026c0e21a6a90726ea61228d45a2090627be89000",
      ],
      ["e0440000050100000001", "9000"],
      [
        "e04480003b013832001400c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed66830100000000f2052a0100000020a1a0159d58cc4f19",
        "9000",
      ],
      [
        "e04480001d76a9144fb4f23b006689f3fef238ab8305899250ab750b88acffffffff",
        "9000",
      ],
      [
        "e04a80002301805b6d29010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "00009000",
      ],
      [
        "e04800001b058000002c80000003800000000000000000000000000000000001",
        "314402206d2c8bc536e79945faeb5197f3aec4afd57bc158ff1585c1b3cbd38f9617a5da02207c30ea9450bf4aeb1e6fdc9a0b39b042cac7925aab0a750f2d48157df9f0865a019000",
      ],
    ],
    signedTransaction:
      "0x0100000001c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed6683010000006a47304402206d2c8bc536e79945faeb5197f3aec4afd57bc158ff1585c1b3cbd38f9617a5da02207c30ea9450bf4aeb1e6fdc9a0b39b042cac7925aab0a750f2d48157df9f0865a0121024d924f6587fcf74f7ca08771cd8eebddeb314f488d17070f2dcc13f96969aa57ffffffff01805b6d29010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
  {
    name: "Dogecoin: two inputs, change, lock time and RBF sequences",
    profile: DOGECOIN_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "eaa8d810c854b9a614cc52aa9ee0e0c99fdd31ac086a0e61041f0007b7e4443000000000",
                )!,
                script: hexaStringToBuffer(
                  "48cf81c68923784e6e33d1a8f559a8ad75a3952dec6f577c2f9abb0ffe07ae2cf54983e718f733716188ac89ca51dcb3649f245bb31ec0548f2d5ae8d193c7294a3f0a0f56bd615c5621026024f7fc94cc49426df9687f8c146eb04464f3e3d3fa867e408a68738a2a8a1b",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("80588d4900000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("00f2052a01000000")!,
                script: hexaStringToBuffer(
                  "76a9144fb4f23b006689f3fef238ab8305899250ab750b88ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          4294967293,
        ],
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "878acc0210703f9032608b18babfe8f4c5cfaf30d7ee37ccef2a46db45f0eb3800000000",
                )!,
                script: hexaStringToBuffer(
                  "487e925cb14024fb90de872664da55bf102eeca16fdba727c41440aebbc1496dae8dc018335d51674fd7890198449838199c1469ed520b971d9329391b0482991d1971541346d59b5b2102b353d504fadc1d1da38ad73d23b96cd437d1f8f44c930c90319d694e7af5cc5b",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
              {
                prevout: hexaStringToBuffer(
                  "142dc509c4d8f7f570debc58454c4a268ecd42e76abb7656714d7ab23e12839d01000000",
                )!,
                script: hexaStringToBuffer(
                  "4821db5885203691b069c623844d067ab2af096c4be04c7d79acebae2515450663e17490ebe4e7a74a45827797712805255df9084a3dd3680d404a678494f3a5bd2a815d389e67c98a2102e7ec75cb11bc5e9bb7cea6aa90d7b262ed6c4c5506862bc007659c11eeeeb767",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("005ed0b200000000")!,
                script: hexaStringToBuffer(
                  "76a914b26e3063d8c7713accce19455e628c2ece20e3a488ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("a0252600")!,
          },
          0,
          null,
          4294967293,
        ],
      ],
      associatedKeysets: ["44'/3'/0'/0/0", "44'/3'/0'/0/1"],
      changePath: "44'/3'/0'/1/0",
      outputScriptHex:
        "0200bca065010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00670476000000001976a914e912b4fbdb8986cda0e790a4f10dddf364f1b17988ac",
      lockTime: 2800000,
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025eaa8d810c854b9a614cc52aa9ee0e0c99fdd31ac086a0e61041f0007b7e44430000000006b",
        "9000",
      ],
      [
        "e04280003248cf81c68923784e6e33d1a8f559a8ad75a3952dec6f577c2f9abb0ffe07ae2cf54983e718f733716188ac89ca51dcb3649f",
        "9000",
      ],
      [
        "e042800032245bb31ec0548f2d5ae8d193c7294a3f0a0f56bd615c5621026024f7fc94cc49426df9687f8c146eb04464f3e3d3fa867e40",
        "9000",
      ],
      ["e04280000b8a68738a2a8a1bffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002280588d49000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e04280002200f2052a010000001976a9144fb4f23b006689f3fef238ab8305899250ab750b88ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "32003ea7c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed66830100000000f2052a01000000724aaf275ef41ca19000",
      ],
      ["e042000009000000000100000002", "9000"],
      [
        "e042800025878acc0210703f9032608b18babfe8f4c5cfaf30d7ee37ccef2a46db45f0eb38000000006b",
        "9000",
      ],
      [
        "e042800032487e925cb14024fb90de872664da55bf102eeca16fdba727c41440aebbc1496dae8dc018335d51674fd7890198449838199c",
        "9000",
      ],
      [
        "e0428000321469ed520b971d9329391b0482991d1971541346d59b5b2102b353d504fadc1d1da38ad73d23b96cd437d1f8f44c930c9031",
        "9000",
      ],
      ["e04280000b9d694e7af5cc5bffffffff", "9000"],
      [
        "e042800025142dc509c4d8f7f570debc58454c4a268ecd42e76abb7656714d7ab23e12839d010000006b",
        "9000",
      ],
      [
        "e0428000324821db5885203691b069c623844d067ab2af096c4be04c7d79acebae2515450663e17490ebe4e7a74a45827797712805255d",
        "9000",
      ],
      [
        "e042800032f9084a3dd3680d404a678494f3a5bd2a815d389e67c98a2102e7ec75cb11bc5e9bb7cea6aa90d7b262ed6c4c5506862bc007",
        "9000",
      ],
      ["e04280000b659c11eeeeb767ffffffff", "9000"],
      ["e04280000101", "9000"],
      [
        "e042800022005ed0b2000000001976a914b26e3063d8c7713accce19455e628c2ece20e3a488ac",
        "9000",
      ],
      [
        "e042800004a0252600",
        "32009d8878282b7c31e2da482ac3b88a44b1d7b85cfdc89dff5049447994b87e7fd0e5ca00000000005ed0b20000000057b6c0a26a6e20169000",
      ],
      [
        "e040000015058000002c80000003800000000000000000000000",
        "41044d924f6587fcf74f7ca08771cd8eebddeb314f488d17070f2dcc13f96969aa57d20fd9b2ee6f16510ca190ce41833ec573abc63c2bd8d10b40170db6ee9362ea2244435159676d796e4258504b6162503757576238594d355232713334685378775746aac765706e1e25078a4aa98726f026c0e21a6a90726ea61228d45a2090627be89000",
      ],
      [
        "e040000015058000002c80000003800000000000000000000001",
        "41044c77b70334dc101e4a071ef1d115f9dbe97630ad441117b881a27aa498f23a0013e85c313934d552b58a26c0658f804ecaee9862d6b4133cdd270ddc828ae4b822444d515970554b5648767a795258335a4b753568426f646650436d625574664b454c0faef3aeed5c52f27c5f99bce9bbb5abec295c129cd9d930ca7bedf62c6d65af9000",
      ],
      ["e0440000050100000002", "9000"],
      [
        "e04480003b013832003ea7c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed66830100000000f2052a01000000724aaf275ef41ca119",
        "9000",
      ],
      [
        "e04480001d76a9144fb4f23b006689f3fef238ab8305899250ab750b88acfdffffff",
        "9000",
      ],
      [
        "e04480003b013832009d8878282b7c31e2da482ac3b88a44b1d7b85cfdc89dff5049447994b87e7fd0e5ca00000000005ed0b20000000057b6c0a26a6e201600",
        "9000",
      ],
      ["e044800004fdffffff", "9000"],
      ["e04aff0015058000002c80000003800000000000000100000000", "9000"],
      [
        "e04a0000320200bca065010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00670476000000001976a914e912b4",
        "009000",
      ],
      ["e04a800013fbdb8986cda0e790a4f10dddf364f1b17988ac", "00009000"],
      [
        "e04800001b058000002c8000000380000000000000000000000000002ab98001",
        "314402204771767ed42c001a36be5662ee37f3ead8d394bc9d1ddf0d3194455b24f2dba302204d6e2c6ff43c49c84af7fb7ba1d795392c9501405ff4bb6a9828e937d7bc4f4d019000",
      ],
      ["e0440080050100000002", "9000"],
      [
        "e04480803b013832003ea7c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed66830100000000f2052a01000000724aaf275ef41ca100",
        "9000",
      ],
      ["e044808004fdffffff", "9000"],
      [
        "e04480803b013832009d8878282b7c31e2da482ac3b88a44b1d7b85cfdc89dff5049447994b87e7fd0e5ca00000000005ed0b20000000057b6c0a26a6e201619",
        "9000",
      ],
      [
        "e04480801d76a914b26e3063d8c7713accce19455e628c2ece20e3a488acfdffffff",
        "9000",
      ],
      ["e04aff0015058000002c80000003800000000000000100000000", "9000"],
      [
        "e04a0000320200bca065010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00670476000000001976a914e912b4",
        "009000",
      ],
      ["e04a800013fbdb8986cda0e790a4f10dddf364f1b17988ac", "00009000"],
      [
        "e04800001b058000002c8000000380000000000000000000000100002ab98001",
        "314402207f5714ac7eb6c7f0fe2921de37009a8d22a5d67cf9f5d88c7abe7904c39b05c90220427a4a1dabc405aa41b62f4a15c375b3905f42e41217993e98ec8030fbbe5fc3019000",
      ],
    ],
    signedTransaction:
      "0x0100000002c3e7b0c673220405657d4766e2adc41f7096f7ff65a50be1db2f9a6331ed6683010000006a47304402204771767ed42c001a36be5662ee37f3ead8d394bc9d1ddf0d3194455b24f2dba302204d6e2c6ff43c49c84af7fb7ba1d795392c9501405ff4bb6a9828e937d7bc4f4d0121024d924f6587fcf74f7ca08771cd8eebddeb314f488d17070f2dcc13f96969aa57fdffffff78282b7c31e2da482ac3b88a44b1d7b85cfdc89dff5049447994b87e7fd0e5ca000000006a47304402207f5714ac7eb6c7f0fe2921de37009a8d22a5d67cf9f5d88c7abe7904c39b05c90220427a4a1dabc405aa41b62f4a15c375b3905f42e41217993e98ec8030fbbe5fc30121024c77b70334dc101e4a071ef1d115f9dbe97630ad441117b881a27aa498f23a00fdffffff0200bca065010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00670476000000001976a914e912b4fbdb8986cda0e790a4f10dddf364f1b17988ac80b92a00",
  },
  {
    name: "Litecoin: P2SH-wrapped SegWit input",
    profile: LITECOIN_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "e554f4c89667e254bc7ab619321dae8fc355ba048b8da78098cace93212409bf00000000",
                )!,
                script: hexaStringToBuffer(
                  "4842333d89dc46a8370291a76f1236358004d29c198067d2130aa0137db3ed9d6da8f7ddf5a3c0f4b73a56b79227357d2fb369cd4458afd89ac9fe6d1ecdd86ea2a39843584321fc712102e25a0f2a0e26db160f7aa8f4d77eeed09a7257ad4cf9631aff4fae8b4ef54723",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "a914905235fb96ef63021bf37bf107fd5833336d084387",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          null,
        ],
      ],
      associatedKeysets: ["49'/2'/0'/0/0"],
      outputScriptHex:
        "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
      segwit: true,
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025e554f4c89667e254bc7ab619321dae8fc355ba048b8da78098cace93212409bf000000006b",
        "9000",
      ],
      [
        "e0428000324842333d89dc46a8370291a76f1236358004d29c198067d2130aa0137db3ed9d6da8f7ddf5a3c0f4b73a56b79227357d2fb3",
        "9000",
      ],
      [
        "e04280003269cd4458afd89ac9fe6d1ecdd86ea2a39843584321fc712102e25a0f2a0e26db160f7aa8f4d77eeed09a7257ad4cf9631aff",
        "9000",
      ],
      ["e04280000b4fae8b4ef54723ffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000200065cd1d0000000017a914905235fb96ef63021bf37bf107fd5833336d084387",
        "9000",
      ],
      [
        "e04280000400000000",
        "3200c90d07d5b768ee9f362aad3c54fb6e313e8e4065cff2faf8b6652f2631246c903e67010000000065cd1d00000000e64fd680b2a6d8559000",
      ],
      [
        "e040000015058000003180000002800000000000000000000000",
        "410486df4d8f350691dec03bb482e540e9ea0af6507733bf69216ced018bfe445e33055f60d6ca8d2d00f7692ba14449115a0a77c293c7d50b2ceae50ac17500d60e224c684c4e66597643367163634a6636664774394239754872586e57636656775047623a9857a598c2dc6893e5dc0b13a72fa80f1343b6622a4b261e511ef9000855b59000",
      ],
      ["e0440002050100000001", "9000"],
      [
        "e04480023b01383200c90d07d5b768ee9f362aad3c54fb6e313e8e4065cff2faf8b6652f2631246c903e67010000000065cd1d00000000e64fd680b2a6d85500",
        "9000",
      ],
      ["e044800204ffffffff", "9000"],
      [
        "e04a80002301c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "00009000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200c90d07d5b768ee9f362aad3c54fb6e313e8e4065cff2faf8b6652f2631246c903e67010000000065cd1d00000000e64fd680b2a6d85519",
        "9000",
      ],
      [
        "e04480801d76a914f289a2128ee3d1666e67c5154c1f5994c8b8599188acffffffff",
        "9000",
      ],
      [
        "e04800001b058000003180000002800000000000000000000000000000000001",
        "3044022055cbeb4dbb26fec2e623d5e6c795447de3d61101b9667063fe7e996586511a600220483a6c63612c2099c4c771add07b2644c3aafbc76dab9b15b90c0d0f858616e2019000",
      ],
    ],
    signedTransaction:
      "0x0100000000010107d5b768ee9f362aad3c54fb6e313e8e4065cff2faf8b6652f2631246c903e670100000017160014f289a2128ee3d1666e67c5154c1f5994c8b85991ffffffff01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac02473044022055cbeb4dbb26fec2e623d5e6c795447de3d61101b9667063fe7e996586511a600220483a6c63612c2099c4c771add07b2644c3aafbc76dab9b15b90c0d0f858616e201210286df4d8f350691dec03bb482e540e9ea0af6507733bf69216ced018bfe445e3300000000",
  },
  {
    name: "Litecoin: native SegWit inputs, change, lock time and RBF sequences",
    profile: LITECOIN_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "63b03a723d72604072a575508ec9769bcb74f97b53c67f69274c2e49a1f9333d00000000",
                )!,
                script: hexaStringToBuffer(
                  "4877a7fa9e349d4cccdc2380326761ef58a5738e73fa4dd2ac04fec644d240bb4c926d41222dbca99f4e331c9060d2d68e13d900ac5cee8e40c0249056cc46edc6f845d6114bda0239210246c2ae6d4944542748480848a2d21e5ec51151efabd2baf2012fa8e2376389cf",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("0084d71700000000")!,
                script: hexaStringToBuffer(
                  "0014a0ce41f71b72bdcf57f963ef978b82529696e9a8",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          0,
          null,
          4294967293,
        ],
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "f804bff6effc99587a202965a8ada7c03b25f7cac141528763d6b8d80e2bb35200000000",
                )!,
                script: hexaStringToBuffer(
                  "48834e6f40cbf7ec3e0d2fdd4543a9ab9dee48d922cba1e91ba6062419a1ceb6b95b8df66d97101daac3ab301067bb1b650f291a13b4a0e23e0b84fe16d82a28bd5806488d74ba36852102492288b758c0bec67a2901c9af79acbba0d091a304791a489155f7a9dff86bab",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
              {
                prevout: hexaStringToBuffer(
                  "22e843a2bfc8559c0e3383618d1043c6cfd3c5feb655cb813117dc2166a6f1b401000000",
                )!,
                script: hexaStringToBuffer(
                  "480610d720dc48b028cff01a0c519e0e711cb6cdab04d0ced14b6a4146af381f926dde65dcce041c8dcc66a50fa431c224067baeeb34e4ab1d138ee39fad852979043cb0926fbc62e42102f4be63a36c2f145b72442dddd44421a140c5c07d33c0cb66333ff741481a540b",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("801d2c0400000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("00a3e11100000000")!,
                script: hexaStringToBuffer(
                  "001453d1d8b1b3cb2a248bfae3470ba14769b2cd64ae",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("a0252600")!,
          },
          1,
          null,
          4294967293,
        ],
      ],
      associatedKeysets: ["84'/2'/0'/0/0", "84'/2'/0'/0/1"],
      changePath: "84'/2'/0'/1/0",
      outputScriptHex:
        "020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac805cd705000000001600147b24b805e3b225ab300030466fcb779fc6c3870d",
      lockTime: 2800000,
      segwit: true,
      additionals: ["bech32"],
    },
    exchanges: [
      ["e042000009000000000100000001", "9000"],
      [
        "e04280002563b03a723d72604072a575508ec9769bcb74f97b53c67f69274c2e49a1f9333d000000006b",
        "9000",
      ],
      [
        "e0428000324877a7fa9e349d4cccdc2380326761ef58a5738e73fa4dd2ac04fec644d240bb4c926d41222dbca99f4e331c9060d2d68e13",
        "9000",
      ],
      [
        "e042800032d900ac5cee8e40c0249056cc46edc6f845d6114bda0239210246c2ae6d4944542748480848a2d21e5ec51151efabd2baf201",
        "9000",
      ],
      ["e04280000b2fa8e2376389cfffffffff", "9000"],
      ["e04280000101", "9000"],
      [
        "e04280001f0084d71700000000160014a0ce41f71b72bdcf57f963ef978b82529696e9a8",
        "9000",
      ],
      [
        "e04280000400000000",
        "32000f0671401675b273a2f9189cc26f0feaade658e6e1476db503c6d397da2f7393a960000000000084d71700000000ab2d2c992f8162129000",
      ],
      ["e042000009000000010100000002", "9000"],
      [
        "e042800025f804bff6effc99587a202965a8ada7c03b25f7cac141528763d6b8d80e2bb352000000006b",
        "9000",
      ],
      [
        "e04280003248834e6f40cbf7ec3e0d2fdd4543a9ab9dee48d922cba1e91ba6062419a1ceb6b95b8df66d97101daac3ab301067bb1b650f",
        "9000",
      ],
      [
        "e042800032291a13b4a0e23e0b84fe16d82a28bd5806488d74ba36852102492288b758c0bec67a2901c9af79acbba0d091a304791a4891",
        "9000",
      ],
      ["e04280000b55f7a9dff86babffffffff", "9000"],
      [
        "e04280002522e843a2bfc8559c0e3383618d1043c6cfd3c5feb655cb813117dc2166a6f1b4010000006b",
        "9000",
      ],
      [
        "e042800032480610d720dc48b028cff01a0c519e0e711cb6cdab04d0ced14b6a4146af381f926dde65dcce041c8dcc66a50fa431c22406",
        "9000",
      ],
      [
        "e0428000327baeeb34e4ab1d138ee39fad852979043cb0926fbc62e42102f4be63a36c2f145b72442dddd44421a140c5c07d33c0cb6633",
        "9000",
      ],
      ["e04280000b3ff741481a540bffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e042800022801d2c04000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e04280001f00a3e1110000000016001453d1d8b1b3cb2a248bfae3470ba14769b2cd64ae",
        "9000",
      ],
      [
        "e042800004a0252600",
        "3200ec195ba53926b2a4035076a7e2b1be792c298b7f07d03c59fc6aa5bcd0402072cb250100000000a3e111000000004cb3e45a5aab04fe9000",
      ],
      [
        "e040000015058000005480000002800000000000000000000000",
        "4104217a1a30898af08d4afc46cac681fc2b0a283d6c3ad9b09a7a27d2a2aaf9d33674ca235e5ca70615f734a2deef120e82fd46fb08c125a8076b740d6aae7ed69d224c5a744454775737525462536e57345776326f4779574b786b38555a435368474c785df04e87d504561a2555f2dbd01d6920cc4184ae85f1bf1bd416b6a1a2dcb2329000",
      ],
      [
        "e040000015058000005480000002800000000000000000000001",
        "410476729aafec17da024f155881bcaaf686719579106a033eb7c5a980186d5584be8942321bbc393b97ad23790c1c171d78fdd2c15403ea6a303210cff8f34f2028224c5373396a584762754e653767625a55466b4177366e576878476d4c6f415a76795648e002d9029ec2a9945acf4d21be00fa59d0a5e0072520f75e70dbeae522373c9000",
      ],
      ["e0440002050100000002", "9000"],
      [
        "e04480023b013832000f0671401675b273a2f9189cc26f0feaade658e6e1476db503c6d397da2f7393a960000000000084d71700000000ab2d2c992f81621200",
        "9000",
      ],
      ["e044800204fdffffff", "9000"],
      [
        "e04480023b01383200ec195ba53926b2a4035076a7e2b1be792c298b7f07d03c59fc6aa5bcd0402072cb250100000000a3e111000000004cb3e45a5aab04fe00",
        "9000",
      ],
      ["e044800204fdffffff", "9000"],
      ["e04aff0015058000005480000002800000000000000100000000", "9000"],
      [
        "e04a000032020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac805cd705000000001600147b24b805",
        "009000",
      ],
      ["e04a800010e3b225ab300030466fcb779fc6c3870d", "00009000"],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b013832000f0671401675b273a2f9189cc26f0feaade658e6e1476db503c6d397da2f7393a960000000000084d71700000000ab2d2c992f81621219",
        "9000",
      ],
      [
        "e04480801d76a914a0ce41f71b72bdcf57f963ef978b82529696e9a888acfdffffff",
        "9000",
      ],
      [
        "e04800001b05800000548000000280000000000000000000000000002ab98001",
        "3045022100b0d88cd9396a4191afce9223561e366b0576853fb2c51b2df7473d67144e3967022004331c064b96a3450cbcad7bebe1061c1c0fbdaa8208edf2dbeefb2677cc5c6e019000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200ec195ba53926b2a4035076a7e2b1be792c298b7f07d03c59fc6aa5bcd0402072cb250100000000a3e111000000004cb3e45a5aab04fe19",
        "9000",
      ],
      [
        "e04480801d76a91453d1d8b1b3cb2a248bfae3470ba14769b2cd64ae88acfdffffff",
        "9000",
      ],
      [
        "e04800001b05800000548000000280000000000000000000000100002ab98001",
        "3044022019dc7d7887562ebe897b0bab6210cb47f8d9cd3a67015659f0c3b6d97bc7121c022038fee82c9b4eddfabb37d60b03f2c0716977a3d7f64ec42610b0653b2f838a0d019000",
      ],
    ],
    signedTransaction:
      "0x0100000000010271401675b273a2f9189cc26f0feaade658e6e1476db503c6d397da2f7393a9600000000000fdffffff5ba53926b2a4035076a7e2b1be792c298b7f07d03c59fc6aa5bcd0402072cb250100000000fdffffff020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac805cd705000000001600147b24b805e3b225ab300030466fcb779fc6c3870d02483045022100b0d88cd9396a4191afce9223561e366b0576853fb2c51b2df7473d67144e3967022004331c064b96a3450cbcad7bebe1061c1c0fbdaa8208edf2dbeefb2677cc5c6e012103217a1a30898af08d4afc46cac681fc2b0a283d6c3ad9b09a7a27d2a2aaf9d33602473044022019dc7d7887562ebe897b0bab6210cb47f8d9cd3a67015659f0c3b6d97bc7121c022038fee82c9b4eddfabb37d60b03f2c0716977a3d7f64ec42610b0653b2f838a0d01210276729aafec17da024f155881bcaaf686719579106a033eb7c5a980186d5584be80b92a00",
  },
  {
    name: "Bitcoin Cash: one input, one output",
    profile: BITCOIN_CASH_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "fa5b55d3ca7d51192bbba307401e3d6e61c4d2896d90ccfce8aae40dfafdb4ac00000000",
                )!,
                script: hexaStringToBuffer(
                  "489cbf783ab9532a94e162dc2c37456809ab128aa33bbe7d35a06574e3fa2c9f7f181459bbb79b1a2be44a63298dd23ccdbcc1ca79f14f8f5f50346d956b82000a7a742bb9fc5c8f38210204f1c86c42de2644b8827bf73010d6b6c3b3c85e81f1838d794f567930bc7ff5",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          null,
        ],
      ],
      associatedKeysets: ["44'/145'/0'/0/0"],
      outputScriptHex:
        "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
      sigHashType: 0x41,
      additionals: ["bitcoin_cash", "bip143"],
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025fa5b55d3ca7d51192bbba307401e3d6e61c4d2896d90ccfce8aae40dfafdb4ac000000006b",
        "9000",
      ],
      [
        "e042800032489cbf783ab9532a94e162dc2c37456809ab128aa33bbe7d35a06574e3fa2c9f7f181459bbb79b1a2be44a63298dd23ccdbc",
        "9000",
      ],
      [
        "e042800032c1ca79f14f8f5f50346d956b82000a7a742bb9fc5c8f38210204f1c86c42de2644b8827bf73010d6b6c3b3c85e81f1838d79",
        "9000",
      ],
      ["e04280000b4f567930bc7ff5ffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "3200cd13cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d00000000ab52bcf4fab3d4a39000",
      ],
      [
        "e040000015058000002c80000091800000000000000000000000",
        "4104bbe40d5c63bd949ad001bb3eab9352afb5e3cf8e58c9b4b7c9ad3cc06f19f0fd835623f5f77911725a7382c48c1fac0c3385c00a3d867cdc822a333ed6a72bb9223144626275434161396a4734586e5539674b595758385677354c754571695061776e37552d7f2a42c1d7a423a8bf21d2b4dd81029e8cdf58663c2173121ac6e93c649000",
      ],
      ["e0440002050100000001", "9000"],
      [
        "e04480023b01383200cd13cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d00000000ab52bcf4fab3d4a300",
        "9000",
      ],
      ["e044800204ffffffff", "9000"],
      [
        "e04a80002301c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "00009000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200cd13cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d00000000ab52bcf4fab3d4a319",
        "9000",
      ],
      [
        "e04480801d76a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388acffffffff",
        "9000",
      ],
      [
        "e04800001b058000002c80000091800000000000000000000000000000000041",
        "3045022100940ade69d11166dec49a5cb591e0499545150794c02b3fe6bbf14a90239faf7a022064a8f1cc35c04467e282d9e7e7efc52ab3854f7dbada7c87f74c04194cba3609419000",
      ],
    ],
    signedTransaction:
      "0x0100000001cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000006b483045022100940ade69d11166dec49a5cb591e0499545150794c02b3fe6bbf14a90239faf7a022064a8f1cc35c04467e282d9e7e7efc52ab3854f7dbada7c87f74c04194cba3609412103bbe40d5c63bd949ad001bb3eab9352afb5e3cf8e58c9b4b7c9ad3cc06f19f0fdffffffff01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
  {
    name: "Bitcoin Cash: two inputs, change, lock time and RBF sequences",
    profile: BITCOIN_CASH_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "fa5b55d3ca7d51192bbba307401e3d6e61c4d2896d90ccfce8aae40dfafdb4ac00000000",
                )!,
                script: hexaStringToBuffer(
                  "489cbf783ab9532a94e162dc2c37456809ab128aa33bbe7d35a06574e3fa2c9f7f181459bbb79b1a2be44a63298dd23ccdbcc1ca79f14f8f5f50346d956b82000a7a742bb9fc5c8f38210204f1c86c42de2644b8827bf73010d6b6c3b3c85e81f1838d794f567930bc7ff5",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          4294967293,
        ],
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "21e79e6ae8be56f45920feda8bf38d11130d9fe93a423027808e09086d6fe5af00000000",
                )!,
                script: hexaStringToBuffer(
                  "48b9c30e8706ec99d5b4a14c420bfa42f9c87dea99849632b64c5fda77a8f0d5a31d3df555ae2bfefe3efc243ae3da101d684c0c88e88522cc2d55c97d7e015515407e53cf6a8f7d0f210294c0ffc479d72f359511651a81702621006309ff687caeaef48020bb42cb11c7",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
              {
                prevout: hexaStringToBuffer(
                  "49f5168ec6d460b920ae1b036f68c5282c946e1044584803a9b04f3e7eed767501000000",
                )!,
                script: hexaStringToBuffer(
                  "4828be3e4a0159976745e55c189117a8ce7d3012ed5f0903ac465b60c0c804d985bc0370a951d9c01a7b771b040850f1f2a11db70f4beedbd4f6c3bf1614669e2517458ec076b375ef2102c58929a6d88f3034e46be5e3264274ecd18258a4b0e0bb6d0d9e17eeab925540",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("00a3e11100000000")!,
                script: hexaStringToBuffer(
                  "76a9145cc2d0238a9ece1b26b8f22a96d62aca848bcc6188ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("60ae0a00")!,
          },
          0,
          null,
          4294967293,
        ],
      ],
      associatedKeysets: ["44'/145'/0'/0/0", "44'/145'/0'/0/1"],
      changePath: "44'/145'/0'/1/0",
      outputScriptHex:
        "020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a9145b5aa420c4b2272bc06ad7c2785d806a5208524788ac",
      lockTime: 800000,
      sigHashType: 0x41,
      additionals: ["bitcoin_cash", "bip143"],
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025fa5b55d3ca7d51192bbba307401e3d6e61c4d2896d90ccfce8aae40dfafdb4ac000000006b",
        "9000",
      ],
      [
        "e042800032489cbf783ab9532a94e162dc2c37456809ab128aa33bbe7d35a06574e3fa2c9f7f181459bbb79b1a2be44a63298dd23ccdbc",
        "9000",
      ],
      [
        "e042800032c1ca79f14f8f5f50346d956b82000a7a742bb9fc5c8f38210204f1c86c42de2644b8827bf73010d6b6c3b3c85e81f1838d79",
        "9000",
      ],
      ["e04280000b4f567930bc7ff5ffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "320026d2cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d0000000000c52f5d3da9004c9000",
      ],
      ["e042000009000000000100000002", "9000"],
      [
        "e04280002521e79e6ae8be56f45920feda8bf38d11130d9fe93a423027808e09086d6fe5af000000006b",
        "9000",
      ],
      [
        "e04280003248b9c30e8706ec99d5b4a14c420bfa42f9c87dea99849632b64c5fda77a8f0d5a31d3df555ae2bfefe3efc243ae3da101d68",
        "9000",
      ],
      [
        "e0428000324c0c88e88522cc2d55c97d7e015515407e53cf6a8f7d0f210294c0ffc479d72f359511651a81702621006309ff687caeaef4",
        "9000",
      ],
      ["e04280000b8020bb42cb11c7ffffffff", "9000"],
      [
        "e04280002549f5168ec6d460b920ae1b036f68c5282c946e1044584803a9b04f3e7eed7675010000006b",
        "9000",
      ],
      [
        "e0428000324828be3e4a0159976745e55c189117a8ce7d3012ed5f0903ac465b60c0c804d985bc0370a951d9c01a7b771b040850f1f2a1",
        "9000",
      ],
      [
        "e0428000321db70f4beedbd4f6c3bf1614669e2517458ec076b375ef2102c58929a6d88f3034e46be5e3264274ecd18258a4b0e0bb6d0d",
        "9000",
      ],
      ["e04280000b9e17eeab925540ffffffff", "9000"],
      ["e04280000101", "9000"],
      [
        "e04280002200a3e111000000001976a9145cc2d0238a9ece1b26b8f22a96d62aca848bcc6188ac",
        "9000",
      ],
      [
        "e04280000460ae0a00",
        "3200ff5f4c48f197a692a1cd16a25dae5140db7c5af9e539138791a92292921d03cd4f580000000000a3e11100000000c5977f87e8b2d9829000",
      ],
      [
        "e040000015058000002c80000091800000000000000000000000",
        "4104bbe40d5c63bd949ad001bb3eab9352afb5e3cf8e58c9b4b7c9ad3cc06f19f0fd835623f5f77911725a7382c48c1fac0c3385c00a3d867cdc822a333ed6a72bb9223144626275434161396a4734586e5539674b595758385677354c754571695061776e37552d7f2a42c1d7a423a8bf21d2b4dd81029e8cdf58663c2173121ac6e93c649000",
      ],
      [
        "e040000015058000002c80000091800000000000000000000001",
        "410488d6897f8b36430343542f510d0c30fed8256258e35e8d0bf4a90ad8db090a81150fd2d11c9742efd4b8dee6906aa722ba9b7cd1d3cfc66e8c64c43e93233703223139545559566d38704d55475a666b3733654146507248475070644e47584666774e0b262b5263e2b261b940b7c74862a45cb3cac647e47592d8ab1f38ae6dc8fe359000",
      ],
      ["e0440002050100000002", "9000"],
      [
        "e04480023b0138320026d2cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d0000000000c52f5d3da9004c00",
        "9000",
      ],
      ["e044800204fdffffff", "9000"],
      [
        "e04480023b01383200ff5f4c48f197a692a1cd16a25dae5140db7c5af9e539138791a92292921d03cd4f580000000000a3e11100000000c5977f87e8b2d98200",
        "9000",
      ],
      ["e044800204fdffffff", "9000"],
      ["e04aff0015058000002c80000091800000000000000100000000", "9000"],
      [
        "e04a000032020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a9145b5aa4",
        "009000",
      ],
      ["e04a80001320c4b2272bc06ad7c2785d806a5208524788ac", "00009000"],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b0138320026d2cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d0000000000c52f5d3da9004c19",
        "9000",
      ],
      [
        "e04480801d76a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388acfdffffff",
        "9000",
      ],
      [
        "e04800001b058000002c8000009180000000000000000000000000000c350041",
        "304402200980781419e615af9ad257a7b5f1106c0f94f5d115cde63ee926009008bd615502201f17091ec1d47889297a5677e2043bde78ae8d23ac3c036fcfafe1c16c7cc938419000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200ff5f4c48f197a692a1cd16a25dae5140db7c5af9e539138791a92292921d03cd4f580000000000a3e11100000000c5977f87e8b2d98219",
        "9000",
      ],
      [
        "e04480801d76a9145cc2d0238a9ece1b26b8f22a96d62aca848bcc6188acfdffffff",
        "9000",
      ],
      [
        "e04800001b058000002c8000009180000000000000000000000100000c350041",
        "31440220263dd8a9fe069e158964a6d5b196f837587cf292042995b7a5f6a1d8c6ddbcf2022004b9165c244cb9e3a488d0baa7621d48b765a0804ee68069ede27e9b67ee99c7419000",
      ],
    ],
    signedTransaction:
      "0x0100000002cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000006a47304402200980781419e615af9ad257a7b5f1106c0f94f5d115cde63ee926009008bd615502201f17091ec1d47889297a5677e2043bde78ae8d23ac3c036fcfafe1c16c7cc938412103bbe40d5c63bd949ad001bb3eab9352afb5e3cf8e58c9b4b7c9ad3cc06f19f0fdfdffffff4c48f197a692a1cd16a25dae5140db7c5af9e539138791a92292921d03cd4f58000000006a4730440220263dd8a9fe069e158964a6d5b196f837587cf292042995b7a5f6a1d8c6ddbcf2022004b9165c244cb9e3a488d0baa7621d48b765a0804ee68069ede27e9b67ee99c741210388d6897f8b36430343542f510d0c30fed8256258e35e8d0bf4a90ad8db090a81fdffffff020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a9145b5aa420c4b2272bc06ad7c2785d806a5208524788ac00350c00",
  },
  {
    name: "Bitcoin Gold: one input, one output",
    profile: BITCOIN_GOLD_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "aa63f6dfda84799ef4a1a59eee9a9eac146124a7c0179a19a6cd626a64fabe8800000000",
                )!,
                script: hexaStringToBuffer(
                  "4892f853147106246134621f6d32238ddd3798badd8462999c31bb0c775b80fe58d6772b0636f2843716d543b2f748dc98bc025952210e380be87f1d5a77784d0414489c18b281424621023b807c94b43e1e4e84b57b1134f7a9dab49dc044dc422dfba2388bc98f072de9",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9145d511a96e4c2c86dfc0132afe2a39d35248ce57488ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          null,
        ],
      ],
      associatedKeysets: ["44'/156'/0'/0/0"],
      outputScriptHex:
        "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
      sigHashType: 0x41,
      additionals: ["bitcoin_gold", "bip143"],
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025aa63f6dfda84799ef4a1a59eee9a9eac146124a7c0179a19a6cd626a64fabe88000000006b",
        "9000",
      ],
      [
        "e0428000324892f853147106246134621f6d32238ddd3798badd8462999c31bb0c775b80fe58d6772b0636f2843716d543b2f748dc98bc",
        "9000",
      ],
      [
        "e042800032025952210e380be87f1d5a77784d0414489c18b281424621023b807c94b43e1e4e84b57b1134f7a9dab49dc044dc422dfba2",
        "9000",
      ],
      ["e04280000b388bc98f072de9ffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9145d511a96e4c2c86dfc0132afe2a39d35248ce57488ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "3200e2ad29bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000000065cd1d0000000034447134d7309ee19000",
      ],
      [
        "e040000015058000002c8000009c800000000000000000000000",
        "41049ad2ab92d6d7b6147e8cad76b54d1c8b3a2c298c1c8c2049526659ac2e8bf0afe61334a0b33210425a038fc162ae8ef03927c4294c8347f7017fda3b1252e3912247534d4c5241505a685175356f455769527568336f37695a7a4578616e7341653573e19c1c226eaa2c81b4ade818f7172c430d3235a6dfb66c813ec2dded709aff999000",
      ],
      ["e0440002050100000001", "9000"],
      [
        "e04480023b01383200e2ad29bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000000065cd1d0000000034447134d7309ee100",
        "9000",
      ],
      ["e044800204ffffffff", "9000"],
      [
        "e04a80002301c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "00009000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200e2ad29bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000000065cd1d0000000034447134d7309ee119",
        "9000",
      ],
      [
        "e04480801d76a9145d511a96e4c2c86dfc0132afe2a39d35248ce57488acffffffff",
        "9000",
      ],
      [
        "e04800001b058000002c8000009c800000000000000000000000000000000041",
        "30450221009645e891ade841f0298383d3c10e947ee095c1c624a8524e43dc6b799e9076b5022075c3b4a181f61be1931c3f8757df8a10e01777eee45d7ec2c070363490858a92419000",
      ],
    ],
    signedTransaction:
      "0x010000000129bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000006b4830450221009645e891ade841f0298383d3c10e947ee095c1c624a8524e43dc6b799e9076b5022075c3b4a181f61be1931c3f8757df8a10e01777eee45d7ec2c070363490858a924121039ad2ab92d6d7b6147e8cad76b54d1c8b3a2c298c1c8c2049526659ac2e8bf0afffffffff01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
  {
    name: "Bitcoin Gold: two inputs, change, lock time and RBF sequences",
    profile: BITCOIN_GOLD_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "aa63f6dfda84799ef4a1a59eee9a9eac146124a7c0179a19a6cd626a64fabe8800000000",
                )!,
                script: hexaStringToBuffer(
                  "4892f853147106246134621f6d32238ddd3798badd8462999c31bb0c775b80fe58d6772b0636f2843716d543b2f748dc98bc025952210e380be87f1d5a77784d0414489c18b281424621023b807c94b43e1e4e84b57b1134f7a9dab49dc044dc422dfba2388bc98f072de9",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9145d511a96e4c2c86dfc0132afe2a39d35248ce57488ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          4294967293,
        ],
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "2e577f6450cc6081ae219c17e088cead6a4beacb811041a31b9ba94b1aced8e400000000",
                )!,
                script: hexaStringToBuffer(
                  "484fe11a0d90bf3f42d74e8866db4a0e574140708c9de2a266c6fa426a32b8b22f34928ed241b41581acbdf392de1f11a3b6f568580e12d21c0d1dbc901850b5a84e17d6b9a19ef58221020a1f6fb7aa36d0a5e82a6bedec9d4ffc3ca662afeaf0af039f701cb0bd9c832e",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
              {
                prevout: hexaStringToBuffer(
                  "058a878ececb513ef73872457bbae353e5559c433f66bb9ee5791570829db81f01000000",
                )!,
                script: hexaStringToBuffer(
                  "48175fb659472b470682990e458d7a61009f38384052e5ae2b00f2a66f0ee550b17e88886e0a918d42cdc2bbebb2391e539be35c8523aa88ae949b57f8798a2902ead84fde777352b121023ebf2ff72163867b0f7f2ea360e324a1a41f8d9834ded9f6df4b75d955931cff",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("00a3e11100000000")!,
                script: hexaStringToBuffer(
                  "76a914585b9b4097f0e703d825a1f64b131a278b1515f788ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("60ae0a00")!,
          },
          0,
          null,
          4294967293,
        ],
      ],
      associatedKeysets: ["44'/156'/0'/0/0", "44'/156'/0'/0/1"],
      changePath: "44'/156'/0'/1/0",
      outputScriptHex:
        "020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a91415b0c4af8e640d7720543eddc40d08be12457a1b88ac",
      lockTime: 800000,
      sigHashType: 0x41,
      additionals: ["bitcoin_gold", "bip143"],
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025aa63f6dfda84799ef4a1a59eee9a9eac146124a7c0179a19a6cd626a64fabe88000000006b",
        "9000",
      ],
      [
        "e0428000324892f853147106246134621f6d32238ddd3798badd8462999c31bb0c775b80fe58d6772b0636f2843716d543b2f748dc98bc",
        "9000",
      ],
      [
        "e042800032025952210e380be87f1d5a77784d0414489c18b281424621023b807c94b43e1e4e84b57b1134f7a9dab49dc044dc422dfba2",
        "9000",
      ],
      ["e04280000b388bc98f072de9ffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9145d511a96e4c2c86dfc0132afe2a39d35248ce57488ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "3200df2929bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000000065cd1d00000000b86cda87d60300cd9000",
      ],
      ["e042000009000000000100000002", "9000"],
      [
        "e0428000252e577f6450cc6081ae219c17e088cead6a4beacb811041a31b9ba94b1aced8e4000000006b",
        "9000",
      ],
      [
        "e042800032484fe11a0d90bf3f42d74e8866db4a0e574140708c9de2a266c6fa426a32b8b22f34928ed241b41581acbdf392de1f11a3b6",
        "9000",
      ],
      [
        "e042800032f568580e12d21c0d1dbc901850b5a84e17d6b9a19ef58221020a1f6fb7aa36d0a5e82a6bedec9d4ffc3ca662afeaf0af039f",
        "9000",
      ],
      ["e04280000b701cb0bd9c832effffffff", "9000"],
      [
        "e042800025058a878ececb513ef73872457bbae353e5559c433f66bb9ee5791570829db81f010000006b",
        "9000",
      ],
      [
        "e04280003248175fb659472b470682990e458d7a61009f38384052e5ae2b00f2a66f0ee550b17e88886e0a918d42cdc2bbebb2391e539b",
        "9000",
      ],
      [
        "e042800032e35c8523aa88ae949b57f8798a2902ead84fde777352b121023ebf2ff72163867b0f7f2ea360e324a1a41f8d9834ded9f6df",
        "9000",
      ],
      ["e04280000b4b75d955931cffffffffff", "9000"],
      ["e04280000101", "9000"],
      [
        "e04280002200a3e111000000001976a914585b9b4097f0e703d825a1f64b131a278b1515f788ac",
        "9000",
      ],
      [
        "e04280000460ae0a00",
        "32009db4a0d76fb568e51d65602a44a1737d5996b670870cbf92e82513799e9bb6c2f1b80000000000a3e11100000000f6bed85c0a8b32de9000",
      ],
      [
        "e040000015058000002c8000009c800000000000000000000000",
        "41049ad2ab92d6d7b6147e8cad76b54d1c8b3a2c298c1c8c2049526659ac2e8bf0afe61334a0b33210425a038fc162ae8ef03927c4294c8347f7017fda3b1252e3912247534d4c5241505a685175356f455769527568336f37695a7a4578616e7341653573e19c1c226eaa2c81b4ade818f7172c430d3235a6dfb66c813ec2dded709aff999000",
      ],
      [
        "e040000015058000002c8000009c800000000000000000000001",
        "4104047444b81b5b0bf8b0ec65f250d90a5e0ceb565dd3847674397184bf5bb9b16e61e0ad14fae71958295086772b5dc905e3cf3a0ff4fbdbe480e5f0ef29bc124122475275376377466f4836423432586443767832636369767737596339485a5a55677080ee739b9b3875fe506675b47a8256aa4267063f68c0933b1458ca22930d4bbf9000",
      ],
      ["e0440002050100000002", "9000"],
      [
        "e04480023b01383200df2929bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000000065cd1d00000000b86cda87d60300cd00",
        "9000",
      ],
      ["e044800204fdffffff", "9000"],
      [
        "e04480023b013832009db4a0d76fb568e51d65602a44a1737d5996b670870cbf92e82513799e9bb6c2f1b80000000000a3e11100000000f6bed85c0a8b32de00",
        "9000",
      ],
      ["e044800204fdffffff", "9000"],
      ["e04aff0015058000002c8000009c800000000000000100000000", "9000"],
      [
        "e04a000032020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a91415b0c4",
        "009000",
      ],
      ["e04a800013af8e640d7720543eddc40d08be12457a1b88ac", "00009000"],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200df2929bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000000065cd1d00000000b86cda87d60300cd19",
        "9000",
      ],
      [
        "e04480801d76a9145d511a96e4c2c86dfc0132afe2a39d35248ce57488acfdffffff",
        "9000",
      ],
      [
        "e04800001b058000002c8000009c80000000000000000000000000000c350041",
        "31440220669515346db401e9d1d5e7db400df97d9f64e4fb6e631e2b413a3aaeac412a680220086007a8cd176f1c0d70bd7c5566f54ae29628245e1b8f191ce204bde60e5626419000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b013832009db4a0d76fb568e51d65602a44a1737d5996b670870cbf92e82513799e9bb6c2f1b80000000000a3e11100000000f6bed85c0a8b32de19",
        "9000",
      ],
      [
        "e04480801d76a914585b9b4097f0e703d825a1f64b131a278b1515f788acfdffffff",
        "9000",
      ],
      [
        "e04800001b058000002c8000009c80000000000000000000000100000c350041",
        "304402203281c608b020adf638965509f26d1260ad475509a11245277f2816adac6169de02202b0173683f4c05050c062b8840ff94dbf66beac6c4ac4898ef0f494cb8999cf3419000",
      ],
    ],
    signedTransaction:
      "0x010000000229bef45057d9ccdae3a7f7f9264e8d262f30ceaa9c6f19a4a4f21e2bad1dfcbf010000006a4730440220669515346db401e9d1d5e7db400df97d9f64e4fb6e631e2b413a3aaeac412a680220086007a8cd176f1c0d70bd7c5566f54ae29628245e1b8f191ce204bde60e56264121039ad2ab92d6d7b6147e8cad76b54d1c8b3a2c298c1c8c2049526659ac2e8bf0affdffffffa0d76fb568e51d65602a44a1737d5996b670870cbf92e82513799e9bb6c2f1b8000000006a47304402203281c608b020adf638965509f26d1260ad475509a11245277f2816adac6169de02202b0173683f4c05050c062b8840ff94dbf66beac6c4ac4898ef0f494cb8999cf3412103047444b81b5b0bf8b0ec65f250d90a5e0ceb565dd3847674397184bf5bb9b16efdffffff020046c323000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac803dcd0b000000001976a91415b0c4af8e640d7720543eddc40d08be12457a1b88ac00350c00",
  },
  {
    name: "Bitcoin Cash: cashaddr recipient",
    profile: BITCOIN_CASH_PROFILE,
    transaction: {
      inputs: [
        [
          {
            version: hexaStringToBuffer("01000000")!,
            inputs: [
              {
                prevout: hexaStringToBuffer(
                  "fa5b55d3ca7d51192bbba307401e3d6e61c4d2896d90ccfce8aae40dfafdb4ac00000000",
                )!,
                script: hexaStringToBuffer(
                  "489cbf783ab9532a94e162dc2c37456809ab128aa33bbe7d35a06574e3fa2c9f7f181459bbb79b1a2be44a63298dd23ccdbcc1ca79f14f8f5f50346d956b82000a7a742bb9fc5c8f38210204f1c86c42de2644b8827bf73010d6b6c3b3c85e81f1838d794f567930bc7ff5",
                )!,
                sequence: hexaStringToBuffer("ffffffff")!,
              },
            ],
            outputs: [
              {
                amount: hexaStringToBuffer("40ef5a0700000000")!,
                script: hexaStringToBuffer(
                  "76a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
                )!,
              },
              {
                amount: hexaStringToBuffer("0065cd1d00000000")!,
                script: hexaStringToBuffer(
                  "76a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388ac",
                )!,
              },
            ],
            locktime: hexaStringToBuffer("00000000")!,
          },
          1,
          null,
          null,
        ],
      ],
      associatedKeysets: ["44'/145'/0'/0/0"],
      outputScriptHex:
        "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
      sigHashType: 0x41,
      additionals: ["bitcoin_cash", "bip143", "cashaddr"],
    },
    exchanges: [
      ["e042000009000000010100000001", "9000"],
      [
        "e042800025fa5b55d3ca7d51192bbba307401e3d6e61c4d2896d90ccfce8aae40dfafdb4ac000000006b",
        "9000",
      ],
      [
        "e042800032489cbf783ab9532a94e162dc2c37456809ab128aa33bbe7d35a06574e3fa2c9f7f181459bbb79b1a2be44a63298dd23ccdbc",
        "9000",
      ],
      [
        "e042800032c1ca79f14f8f5f50346d956b82000a7a742bb9fc5c8f38210204f1c86c42de2644b8827bf73010d6b6c3b3c85e81f1838d79",
        "9000",
      ],
      ["e04280000b4f567930bc7ff5ffffffff", "9000"],
      ["e04280000102", "9000"],
      [
        "e04280002240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "9000",
      ],
      [
        "e0428000220065cd1d000000001976a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388ac",
        "9000",
      ],
      [
        "e04280000400000000",
        "3200ef65cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d00000000bba3a538c2b845119000",
      ],
      [
        "e040000015058000002c80000091800000000000000000000000",
        "4104bbe40d5c63bd949ad001bb3eab9352afb5e3cf8e58c9b4b7c9ad3cc06f19f0fd835623f5f77911725a7382c48c1fac0c3385c00a3d867cdc822a333ed6a72bb9223144626275434161396a4734586e5539674b595758385677354c754571695061776e37552d7f2a42c1d7a423a8bf21d2b4dd81029e8cdf58663c2173121ac6e93c649000",
      ],
      ["e0440003050100000001", "9000"],
      [
        "e04480033b01383200ef65cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d00000000bba3a538c2b8451100",
        "9000",
      ],
      ["e044800304ffffffff", "9000"],
      [
        "e04a80002301c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
        "00009000",
      ],
      ["e0440080050100000001", "9000"],
      [
        "e04480803b01383200ef65cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000000065cd1d00000000bba3a538c2b8451119",
        "9000",
      ],
      [
        "e04480801d76a9148a2cc8f91be0e9946ecdbae3a736c81c1414b45388acffffffff",
        "9000",
      ],
      [
        "e04800001b058000002c80000091800000000000000000000000000000000041",
        "3045022100940ade69d11166dec49a5cb591e0499545150794c02b3fe6bbf14a90239faf7a022064a8f1cc35c04467e282d9e7e7efc52ab3854f7dbada7c87f74c04194cba3609419000",
      ],
    ],
    signedTransaction:
      "0x0100000001cfb50141e3dec3c28ab981560b70fe023d9d836b895ebebc71d8407bfeb17730010000006b483045022100940ade69d11166dec49a5cb591e0499545150794c02b3fe6bbf14a90239faf7a022064a8f1cc35c04467e282d9e7e7efc52ab3854f7dbada7c87f74c04194cba3609412103bbe40d5c63bd949ad001bb3eab9352afb5e3cf8e58c9b4b7c9ad3cc06f19f0fdffffffff01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00000000",
  },
];
