import {
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";

import { DefaultKeySerializer } from "@internal/psbt/service/key/DefaultKeySerializer";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";

import { DefaultKeyPairSerializer } from "./DefaultKeyPairSerializer";

describe("DefaultKeyPairSerializer", () => {
  let service: DefaultKeyPairSerializer;
  const valueParser = new DefaultValueParser();

  beforeEach(() => {
    const keySerializerService = new DefaultKeySerializer();
    service = new DefaultKeyPairSerializer(keySerializerService);
  });

  it("Invalid key", () => {
    const keyPair = service.deserialize(
      new ByteArrayParser(Uint8Array.from([])),
    );
    expect(keyPair.isJust()).toStrictEqual(false);
  });

  it("Invalid valueLen", () => {
    const keyPair = service.deserialize(
      new ByteArrayParser(Uint8Array.from([7, 42, 0, 1, 2, 3, 4, 5])),
    );
    expect(keyPair.isJust()).toStrictEqual(false);
  });

  it("Invalid value", () => {
    const keyPair = service.deserialize(
      new ByteArrayParser(Uint8Array.from([7, 42, 0, 1, 2, 3, 4, 5, 2, 7])),
    );
    expect(keyPair.isJust()).toStrictEqual(false);
  });

  it("Serialize and deserialize a keypair", () => {
    // Deserialize a valid keypair
    const parser = new ByteArrayParser(
      Uint8Array.from([
        7, 42, 0, 1, 2, 3, 4, 5, 5, 0xfe, 0x91, 0x45, 0xdc, 0x00, 42,
      ]),
    );

    const maybeKeyPair = service.deserialize(parser);
    expect(maybeKeyPair.isJust()).toStrictEqual(true);
    const keyPair = maybeKeyPair.unsafeCoerce();
    expect(keyPair.key.keyType).toStrictEqual(42);
    expect(keyPair.key.keyData).toStrictEqual(
      Uint8Array.from([0, 1, 2, 3, 4, 5]),
    );
    expect(keyPair.value.data).toStrictEqual(
      Uint8Array.from([0xfe, 0x91, 0x45, 0xdc, 0x00]),
    );
    expect(valueParser.getInt32LE(keyPair.value.data)).toStrictEqual(
      Just(-599420418),
    );
    expect(valueParser.getVarint(keyPair.value.data)).toStrictEqual(
      Just(0xdc4591),
    );
    expect(parser.extract8BitUInt()).toStrictEqual(42);

    // Re-serialize
    const builder = new ByteArrayBuilder();
    service.serialize(builder, keyPair);
    expect(builder.build()).toStrictEqual(
      Uint8Array.from([
        7, 42, 0, 1, 2, 3, 4, 5, 5, 0xfe, 0x91, 0x45, 0xdc, 0x00,
      ]),
    );
  });
});
