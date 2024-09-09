import { ByteArrayBuilder, ByteArrayParser } from "@ledgerhq/device-sdk-core";
import { Just, Maybe, Nothing } from "purify-ts";

/**
 * As described here: https://wiki.bitcoinsv.io/index.php/VarInt
 *
 * - value <= 0xFC:                            value as uint8
 * - 0xFC < value <= 0xFFFF:                   0xFD + value as uint16 LE
 * - 0xFFFF < value <= 0xFFFFFFFF:             0xFE + value as uint32 LE
 * - 0xFFFFFFFF < value <= 0xFFFFFFFFFFFFFFFF: 0xFF + value as uint64 LE
 */
export type Varint = {
  value: number;
  sizeInBytes: number;
};

export function extractVarint(parser: ByteArrayParser): Maybe<Varint> {
  const prefix = parser.extract8BitUInt();
  if (prefix === undefined) {
    return Nothing;
  } else if (prefix <= 0xfc) {
    return Just({ value: prefix, sizeInBytes: 1 });
  } else if (prefix === 0xfd) {
    return Maybe.fromNullable(parser.extract16BitUInt(false)).map((value) => ({
      value,
      sizeInBytes: 3,
    }));
  } else if (prefix === 0xfe) {
    return Maybe.fromNullable(parser.extract32BitUInt(false)).map((value) => ({
      value,
      sizeInBytes: 5,
    }));
  } else {
    return Maybe.fromNullable(parser.extract64BitUInt(false)).chain((value) => {
      if (value > Number.MAX_SAFE_INTEGER) {
        return Nothing;
      } else {
        return Just({ value: Number(value), sizeInBytes: 9 });
      }
    });
  }
}

export function encodeVarint(value: number | bigint): Maybe<Uint8Array> {
  const builder = new ByteArrayBuilder();
  if (value <= 0xfc) {
    builder.add8BitUIntToData(value);
  } else if (value <= 0xffff) {
    builder.add8BitUIntToData(0xfd);
    builder.add16BitUIntToData(value, false);
  } else if (value <= 0xffffffff) {
    builder.add8BitUIntToData(0xfe);
    builder.add32BitUIntToData(value, false);
  } else {
    builder.add8BitUIntToData(0xff);
    builder.add64BitUIntToData(value, false);
  }
  return Maybe.fromNullable(builder.tryBuild());
}
