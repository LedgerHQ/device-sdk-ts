import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { Value } from "@internal/psbt/model/Value";
import { encodeVarint } from "@internal/utils/Varint";

export class DefaultValueFactory {
  fromInt32LE(value: number): Maybe<Value> {
    return Maybe.fromNullable(
      new ByteArrayBuilder().add32BitIntToData(value, false).tryBuild(),
    ).map((buffer) => new Value(buffer));
  }

  fromUInt32LE(value: number): Maybe<Value> {
    return Maybe.fromNullable(
      new ByteArrayBuilder().add32BitUIntToData(value, false).tryBuild(),
    ).map((buffer) => new Value(buffer));
  }

  fromInt64LE(value: number | bigint): Maybe<Value> {
    return Maybe.fromNullable(
      new ByteArrayBuilder().add64BitIntToData(value, false).tryBuild(),
    ).map((buffer) => new Value(buffer));
  }

  fromVarint(value: number | bigint): Maybe<Value> {
    return encodeVarint(value).map((buffer) => new Value(buffer));
  }
}
