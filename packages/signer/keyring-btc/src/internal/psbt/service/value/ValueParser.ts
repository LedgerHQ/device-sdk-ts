import { Maybe } from "purify-ts";

export interface ValueParser {
  getInt32LE(data: Uint8Array): Maybe<number>;
  getVarint(data: Uint8Array): Maybe<number>;
}
