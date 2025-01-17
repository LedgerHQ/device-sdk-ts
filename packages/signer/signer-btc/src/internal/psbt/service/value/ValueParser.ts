import { type Maybe } from "purify-ts";

export interface ValueParser {
  getInt32LE(data: Uint8Array): Maybe<number>;
  getUInt32LE(data: Uint8Array): Maybe<number>;
  getInt64LE(data: Uint8Array): Maybe<bigint>;
  getVarint(data: Uint8Array): Maybe<number>;
}
