import {
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";

import { DefaultKeySerializer } from "./DefaultKeySerializer";

describe("DefaultKeySerializer", () => {
  let builder: ByteArrayBuilder;
  let parser: ByteArrayParser;
  const service = new DefaultKeySerializer();

  beforeEach(() => {
    builder = new ByteArrayBuilder();
  });

  it("Empty buffer", () => {
    parser = new ByteArrayParser(Uint8Array.from([]));
    const key = service.deserialize(parser);
    expect(key.isJust()).toStrictEqual(false);
  });

  it("Empty key", () => {
    parser = new ByteArrayParser(Uint8Array.from([0]));
    const key = service.deserialize(parser);
    expect(key.isJust()).toStrictEqual(false);
  });

  it("No keyType", () => {
    parser = new ByteArrayParser(Uint8Array.from([1]));
    const key = service.deserialize(parser);
    expect(key.isJust()).toStrictEqual(false);
  });

  it("deserialize and serialize a key", () => {
    // deserialize a valid key
    parser = new ByteArrayParser(
      Uint8Array.from([7, 42, 0, 1, 2, 3, 4, 5, 6, 7, 8]),
    );
    const maybeKey = service.deserialize(parser);
    expect(maybeKey.isJust()).toStrictEqual(true);
    const key = maybeKey.unsafeCoerce();
    expect(key.keyType).toStrictEqual(42);
    expect(key.keyData).toStrictEqual(Uint8Array.from([0, 1, 2, 3, 4, 5]));
    expect(key.toHexaString()).toStrictEqual("2a000102030405");

    // serialize
    service.serialize(builder, key);
    expect(builder.build()).toStrictEqual(
      Uint8Array.from([7, 42, 0, 1, 2, 3, 4, 5]),
    );
  });

  it("Serialize and deserialize Key with empty value", () => {
    // deserialize a valid key
    parser = new ByteArrayParser(Uint8Array.from([1, 42]));
    const maybeKey = service.deserialize(parser);
    expect(maybeKey.isJust()).toStrictEqual(true);
    const key = maybeKey.unsafeCoerce();
    expect(key.keyType).toStrictEqual(42);
    expect(key.keyData).toStrictEqual(Uint8Array.from([]));

    // serialize
    service.serialize(builder, key);
    expect(builder.build()).toStrictEqual(Uint8Array.from([1, 42]));
  });
});
