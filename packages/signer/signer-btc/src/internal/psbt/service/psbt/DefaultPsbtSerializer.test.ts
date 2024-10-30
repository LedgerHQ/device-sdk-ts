import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { Key } from "@internal/psbt/model/Key";
import { PsbtGlobal, PsbtIn, PsbtOut } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { DefaultKeySerializer } from "@internal/psbt/service/key/DefaultKeySerializer";
import { DefaultKeyPairSerializer } from "@internal/psbt/service/key-pair/DefaultKeyPairSerializer";
import { DefaultPsbtSerializer } from "@internal/psbt/service/psbt/DefaultPsbtSerializer";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";

describe("DefaultPsbtSerializer tests", () => {
  let service: DefaultPsbtSerializer;
  // Test case from https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#user-content-Test_Vectors
  const SERIALIZED_PSBT_V0 = hexaStringToBuffer(
    "70736274ff0100a00200000002ab0949a08c5af7c49b8212f417e2f15ab3f5c33dcf153821a8139f877a5b7be40000000000feffffffab0949a08c5af7c49b8212f417e2f15ab3f5c33dcf153821a8139f877a5b7be40100000000feffffff02603bea0b000000001976a914768a40bbd740cbe81d988e71de2a4d5c71396b1d88ac8e240000000000001976a9146f4620b553fa095e721b9ee0efe9fa039cca459788ac00000000000100df0200000001268171371edff285e937adeea4b37b78000c0566cbb3ad64641713ca42171bf6000000006a473044022070b2245123e6bf474d60c5b50c043d4c691a5d2435f09a34a7662a9dc251790a022001329ca9dacf280bdf30740ec0390422422c81cb45839457aeb76fc12edd95b3012102657d118d3357b8e0f4c2cd46db7b39f6d9c38d9a70abcb9b2de5dc8dbfe4ce31feffffff02d3dff505000000001976a914d0c59903c5bac2868760e90fd521a4665aa7652088ac00e1f5050000000017a9143545e6e33b832c47050f24d3eeb93c9c03948bc787b32e13000001012000e1f5050000000017a9143545e6e33b832c47050f24d3eeb93c9c03948bc787010416001485d13537f2e265405a34dbafa9e3dda01fb8230800220202ead596687ca806043edc3de116cdf29d5e9257c196cd055cf698c8d02bf24e9910b4a6ba670000008000000080020000800022020394f62be9df19952c5587768aeb7698061ad2c4a25c894f47d8c162b4d7213d0510b4a6ba6700000080010000800200008000",
  )!;
  // Test case from https://github.com/bitcoin/bips/blob/master/bip-0370.mediawiki#user-content-Test_Vectors
  const SERIALIZED_PSBT_V2 = hexaStringToBuffer(
    "70736274ff0102040200000001030400000000010401010105010201fb0402000000000100520200000001c1aa256e214b96a1822f93de42bff3b5f3ff8d0519306e3515d7515a5e805b120000000000ffffffff0118c69a3b00000000160014b0a3af144208412693ca7d166852b52db0aef06e0000000001011f18c69a3b00000000160014b0a3af144208412693ca7d166852b52db0aef06e010e200b0ad921419c1c8719735d72dc739f9ea9e0638d1fe4c1eef0f9944084815fc8010f0400000000011004feffffff0111048c8dc4620112041027000000220202d601f84846a6755f776be00e3d9de8fb10acc935fb83c45fb0162d4cad5ab79218f69d873e540000800100008000000080000000002a0000000103080008af2f000000000104160014c430f64c4756da310dbd1a085572ef299926272c00220202e36fbff53dd534070cf8fd396614680f357a9b85db7340bf1cfa745d2ad7b34018f69d873e54000080010000800000008001000000640000000103088bbdeb0b0000000001041600144dd193ac964a56ac1b9e1cca8454fe2f474f851300",
  )!;

  beforeEach(() => {
    const valueParser = new DefaultValueParser();
    const keyPairSerializerService = new DefaultKeyPairSerializer(
      new DefaultKeySerializer(),
    );
    service = new DefaultPsbtSerializer(valueParser, keyPairSerializerService);
  });

  it("Buffer too small", () => {
    // GIVEN
    const data = SERIALIZED_PSBT_V0.slice(0, 3);

    // WHEN
    const psbt = service.deserialize(data);

    // THEN
    expect(psbt.isRight()).toStrictEqual(false);
  });

  it("Invalid magic", () => {
    // GIVEN
    const data = Uint8Array.from([0x00, ...SERIALIZED_PSBT_V0]);

    // WHEN
    const psbt = service.deserialize(data);

    // THEN
    expect(psbt.isRight()).toStrictEqual(false);
  });

  it("Too many maps", () => {
    // GIVEN
    const data = Uint8Array.from([...SERIALIZED_PSBT_V0, 0x00]);

    // WHEN
    const psbt = service.deserialize(data);

    // THEN
    expect(psbt.isRight()).toStrictEqual(false);
  });

  it("No map", () => {
    // GIVEN
    const data = hexaStringToBuffer("70736274ff")!;

    // WHEN
    const psbt = service.deserialize(data);

    // THEN
    expect(psbt.isRight()).toStrictEqual(false);
  });

  it("Missing input count", () => {
    // GIVEN
    const data = hexaStringToBuffer(
      "70736274ff01020402000000010304000000000105010201fb0402000000",
    )!;

    // WHEN
    const psbt = service.deserialize(data);

    // THEN
    expect(psbt.isRight()).toStrictEqual(false);
  });

  it("PSBTv0 serialization / deserialization", () => {
    // GIVEN
    const data = SERIALIZED_PSBT_V0;

    // WHEN
    const psbt = service.deserialize(data);
    const serialized = service.serialize(psbt.unsafeCoerce());

    expect(psbt.isRight()).toStrictEqual(true);
    expect(serialized).toStrictEqual(SERIALIZED_PSBT_V0);

    // Verify global map content
    expect(psbt.unsafeCoerce().globalMap).toStrictEqual(
      new Map([
        [
          new Key(PsbtGlobal.UNSIGNED_TX).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "0200000002ab0949a08c5af7c49b8212f417e2f15ab3f5c33dcf153821a8139f877a5b7be40000000000feffffffab0949a08c5af7c49b8212f417e2f15ab3f5c33dcf153821a8139f877a5b7be40100000000feffffff02603bea0b000000001976a914768a40bbd740cbe81d988e71de2a4d5c71396b1d88ac8e240000000000001976a9146f4620b553fa095e721b9ee0efe9fa039cca459788ac00000000",
            )!,
          ),
        ],
      ]),
    );

    // Verify inputs
    expect(psbt.unsafeCoerce().inputMaps).toStrictEqual([
      new Map([
        [
          new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "0200000001268171371edff285e937adeea4b37b78000c0566cbb3ad64641713ca42171bf6000000006a473044022070b2245123e6bf474d60c5b50c043d4c691a5d2435f09a34a7662a9dc251790a022001329ca9dacf280bdf30740ec0390422422c81cb45839457aeb76fc12edd95b3012102657d118d3357b8e0f4c2cd46db7b39f6d9c38d9a70abcb9b2de5dc8dbfe4ce31feffffff02d3dff505000000001976a914d0c59903c5bac2868760e90fd521a4665aa7652088ac00e1f5050000000017a9143545e6e33b832c47050f24d3eeb93c9c03948bc787b32e1300",
            )!,
          ),
        ],
      ]),
      new Map([
        [
          new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "00e1f5050000000017a9143545e6e33b832c47050f24d3eeb93c9c03948bc787",
            )!,
          ),
        ],
        [
          new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
          new Value(
            hexaStringToBuffer("001485d13537f2e265405a34dbafa9e3dda01fb82308")!,
          ),
        ],
      ]),
    ]);

    // Verify outputs
    expect(psbt.unsafeCoerce().outputMaps).toStrictEqual([
      new Map([
        [
          new Key(
            PsbtOut.BIP_32_DERIVATION,
            hexaStringToBuffer(
              "02ead596687ca806043edc3de116cdf29d5e9257c196cd055cf698c8d02bf24e99",
            )!,
          ).toHexaString(),
          new Value(hexaStringToBuffer("b4a6ba67000000800000008002000080")!),
        ],
      ]),
      new Map([
        [
          new Key(
            PsbtOut.BIP_32_DERIVATION,
            hexaStringToBuffer(
              "0394f62be9df19952c5587768aeb7698061ad2c4a25c894f47d8c162b4d7213d05",
            )!,
          ).toHexaString(),
          new Value(hexaStringToBuffer("b4a6ba67000000800100008002000080")!),
        ],
      ]),
    ]);
  });

  it("PSBTv2 serialization / deserialization", () => {
    // Deserialize
    const psbt = service.deserialize(SERIALIZED_PSBT_V2);
    expect(psbt.isRight()).toStrictEqual(true);

    // Serialize again to obtain the same buffer
    const serialized = service.serialize(psbt.unsafeCoerce());
    expect(serialized).toStrictEqual(SERIALIZED_PSBT_V2);

    // Verify global map content
    expect(psbt.unsafeCoerce().globalMap).toStrictEqual(
      new Map([
        [
          new Key(PsbtGlobal.TX_VERSION).toHexaString(),
          new Value(hexaStringToBuffer("02000000")!),
        ],
        [
          new Key(PsbtGlobal.FALLBACK_LOCKTIME).toHexaString(),
          new Value(hexaStringToBuffer("00000000")!),
        ],
        [
          new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
          new Value(hexaStringToBuffer("01")!),
        ],
        [
          new Key(PsbtGlobal.OUTPUT_COUNT).toHexaString(),
          new Value(hexaStringToBuffer("02")!),
        ],
        [
          new Key(PsbtGlobal.VERSION).toHexaString(),
          new Value(hexaStringToBuffer("02000000")!),
        ],
      ]),
    );

    // Verify inputs
    expect(psbt.unsafeCoerce().inputMaps).toStrictEqual([
      new Map([
        [
          new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "0200000001c1aa256e214b96a1822f93de42bff3b5f3ff8d0519306e3515d7515a5e805b120000000000ffffffff0118c69a3b00000000160014b0a3af144208412693ca7d166852b52db0aef06e00000000",
            )!,
          ),
        ],
        [
          new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "18c69a3b00000000160014b0a3af144208412693ca7d166852b52db0aef06e",
            )!,
          ),
        ],
        [
          new Key(PsbtIn.PREVIOUS_TXID).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "0b0ad921419c1c8719735d72dc739f9ea9e0638d1fe4c1eef0f9944084815fc8",
            )!,
          ),
        ],
        [
          new Key(PsbtIn.OUTPUT_INDEX).toHexaString(),
          new Value(hexaStringToBuffer("00000000")!),
        ],
        [
          new Key(PsbtIn.SEQUENCE).toHexaString(),
          new Value(hexaStringToBuffer("feffffff")!),
        ],
        [
          new Key(PsbtIn.REQUIRED_TIME_LOCKTIME).toHexaString(),
          new Value(hexaStringToBuffer("8c8dc462")!),
        ],
        [
          new Key(PsbtIn.REQUIRED_HEIGHT_LOCKTIME).toHexaString(),
          new Value(hexaStringToBuffer("10270000")!),
        ],
      ]),
    ]);

    // Verify outputs
    expect(psbt.unsafeCoerce().outputMaps).toStrictEqual([
      new Map([
        [
          new Key(
            PsbtOut.BIP_32_DERIVATION,
            hexaStringToBuffer(
              "02d601f84846a6755f776be00e3d9de8fb10acc935fb83c45fb0162d4cad5ab792",
            )!,
          ).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "f69d873e540000800100008000000080000000002a000000",
            )!,
          ),
        ],
        [
          new Key(PsbtOut.AMOUNT).toHexaString(),
          new Value(hexaStringToBuffer("0008af2f00000000")!),
        ],
        [
          new Key(PsbtOut.SCRIPT).toHexaString(),
          new Value(
            hexaStringToBuffer("0014c430f64c4756da310dbd1a085572ef299926272c")!,
          ),
        ],
      ]),
      new Map([
        [
          new Key(
            PsbtOut.BIP_32_DERIVATION,
            hexaStringToBuffer(
              "02e36fbff53dd534070cf8fd396614680f357a9b85db7340bf1cfa745d2ad7b340",
            )!,
          ).toHexaString(),
          new Value(
            hexaStringToBuffer(
              "f69d873e5400008001000080000000800100000064000000",
            )!,
          ),
        ],
        [
          new Key(PsbtOut.AMOUNT).toHexaString(),
          new Value(hexaStringToBuffer("8bbdeb0b00000000")!),
        ],
        [
          new Key(PsbtOut.SCRIPT).toHexaString(),
          new Value(
            hexaStringToBuffer("00144dd193ac964a56ac1b9e1cca8454fe2f474f8513")!,
          ),
        ],
      ]),
    ]);
  });
});
