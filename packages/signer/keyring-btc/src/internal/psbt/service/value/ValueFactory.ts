import { type Maybe } from "purify-ts";

import { type Value } from "@internal/psbt/model/Value";

export interface ValueFactory {
  fromInt32LE(value: number): Maybe<Value>;
  fromUInt32LE(value: number): Maybe<Value>;
  fromInt64LE(value: number | bigint): Maybe<Value>;
  fromVarint(value: number | bigint): Maybe<Value>;
}
