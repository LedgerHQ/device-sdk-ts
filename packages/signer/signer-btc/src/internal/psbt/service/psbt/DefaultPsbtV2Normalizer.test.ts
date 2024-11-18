import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { PsbtGlobal } from "@internal/psbt/model/Psbt";
import { DefaultKeySerializer } from "@internal/psbt/service/key/DefaultKeySerializer";
import { DefaultKeyPairSerializer } from "@internal/psbt/service/key-pair/DefaultKeyPairSerializer";
import { DefaultValueFactory } from "@internal/psbt/service/value/DefaultValueFactory";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";

import { DefaultPsbtSerializer } from "./DefaultPsbtSerializer";
import { DefaultPsbtV2Normalizer } from "./DefaultPsbtV2Normalizer";

describe("DefaultPsbtV2Normalizer tests", () => {
  const SERIALIZED_PSBT_V0 = hexaStringToBuffer(
    "70736274ff01005202000000011fc1cc5771cb83860cc56d94bcfed938608c17f63662435b41e9c44ffcfd31420100000000fdffffff013905000000000000160014aa8ef374cafadfca76902ddb5cf61c60bbfd9d85000000000001012b4c06000000000000225120fc0a10d308c7e41b4bbc3642f8fd8ac289853b1ce755a0c6d0d495f03d9f2da4010304010000002215c15017108becea8dedc5300bb22386b3ab30367ac262f9ce5e58326eb83e3a22f523206b16e8c1f979fa4cc0f05b6a300affff941459b6f20de77de55b0160ef8e4cacacc021165017108becea8dedc5300bb22386b3ab30367ac262f9ce5e58326eb83e3a22f51d0076223a6e30000080010000800000008002000080000000000000000021166b16e8c1f979fa4cc0f05b6a300affff941459b6f20de77de55b0160ef8e4cac3d01092eda033617e210ee7f7d0e378a404aea1c48b56aa103022becf7746e4700a4f5acc2fd3000008001000080000000800200008000000000000000000117205017108becea8dedc5300bb22386b3ab30367ac262f9ce5e58326eb83e3a22f5011820092eda033617e210ee7f7d0e378a404aea1c48b56aa103022becf7746e4700a40000",
  )!;
  const SERIALIZED_PSBT_V2 = hexaStringToBuffer(
    "70736274ff0102040200000001030400000000010401010105010101fb04020000000001012b4c06000000000000225120fc0a10d308c7e41b4bbc3642f8fd8ac289853b1ce755a0c6d0d495f03d9f2da401030401000000010e201fc1cc5771cb83860cc56d94bcfed938608c17f63662435b41e9c44ffcfd3142010f0401000000011004fdffffff2215c15017108becea8dedc5300bb22386b3ab30367ac262f9ce5e58326eb83e3a22f523206b16e8c1f979fa4cc0f05b6a300affff941459b6f20de77de55b0160ef8e4cacacc021165017108becea8dedc5300bb22386b3ab30367ac262f9ce5e58326eb83e3a22f51d0076223a6e30000080010000800000008002000080000000000000000021166b16e8c1f979fa4cc0f05b6a300affff941459b6f20de77de55b0160ef8e4cac3d01092eda033617e210ee7f7d0e378a404aea1c48b56aa103022becf7746e4700a4f5acc2fd3000008001000080000000800200008000000000000000000117205017108becea8dedc5300bb22386b3ab30367ac262f9ce5e58326eb83e3a22f5011820092eda033617e210ee7f7d0e378a404aea1c48b56aa103022becf7746e4700a40001030839050000000000000104160014aa8ef374cafadfca76902ddb5cf61c60bbfd9d8500",
  )!;
  let psbtSerializer: DefaultPsbtSerializer;
  let psbtV2Normalizer: DefaultPsbtV2Normalizer;

  beforeEach(() => {
    // TODO: should be mocked
    psbtSerializer = new DefaultPsbtSerializer(
      new DefaultValueParser(),
      new DefaultKeyPairSerializer(new DefaultKeySerializer()),
    );
    psbtV2Normalizer = new DefaultPsbtV2Normalizer(
      new DefaultValueParser(),
      new DefaultValueFactory(),
    );
  });

  it("Normalize PSBTv2 should keep it unchanged", () => {
    // Deserialize
    const psbt = psbtSerializer.deserialize(SERIALIZED_PSBT_V2);
    expect(psbt.isRight()).toStrictEqual(true);

    // Normalize
    const normalized = psbtV2Normalizer.normalize(psbt.unsafeCoerce());
    expect(normalized.isRight()).toStrictEqual(true);

    // Re-serialize
    const serialized = psbtSerializer.serialize(normalized.unsafeCoerce());
    expect(serialized).toStrictEqual(SERIALIZED_PSBT_V2);
  });

  it("Normalize PSBTv0 should serialize it to PSBTv2", () => {
    // Deserialize
    const psbt = psbtSerializer.deserialize(SERIALIZED_PSBT_V0);
    expect(psbt.isRight()).toStrictEqual(true);

    // Normalize
    const normalized = psbtV2Normalizer.normalize(psbt.unsafeCoerce());
    expect(normalized.isRight()).toStrictEqual(true);

    // Re-serialize
    const serialized = psbtSerializer.serialize(normalized.unsafeCoerce());
    expect(serialized).toStrictEqual(SERIALIZED_PSBT_V2);
  });

  it("Invalid version PSBTv42", () => {
    // Deserialize
    const psbt = psbtSerializer.deserialize(SERIALIZED_PSBT_V2);
    expect(psbt.isRight()).toStrictEqual(true);

    // Change version to invalid value 42
    psbt
      .unsafeCoerce()
      .setGlobalValue(
        PsbtGlobal.VERSION,
        new DefaultValueFactory().fromInt32LE(42).unsafeCoerce(),
      );

    // Normalize
    const normalized = psbtV2Normalizer.normalize(psbt.unsafeCoerce());
    expect(normalized.isRight()).toStrictEqual(false);
  });

  it("Invalid PSBTv0 with no transaction", () => {
    // Deserialize
    const psbt = psbtSerializer.deserialize(SERIALIZED_PSBT_V2);
    expect(psbt.isRight()).toStrictEqual(true);

    // Change version to 0 while the PSBT has no transaction
    psbt
      .unsafeCoerce()
      .setGlobalValue(
        PsbtGlobal.VERSION,
        new DefaultValueFactory().fromInt32LE(0).unsafeCoerce(),
      );

    // Normalize
    const normalized = psbtV2Normalizer.normalize(psbt.unsafeCoerce());
    expect(normalized.isRight()).toStrictEqual(false);
  });
});
