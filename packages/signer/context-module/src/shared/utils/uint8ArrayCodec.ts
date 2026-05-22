import { Codec, Left, Right } from "purify-ts";

export const uint8ArrayCodec = Codec.custom<Uint8Array>({
  decode: (value) =>
    value instanceof Uint8Array ? Right(value) : Left("Expected a Uint8Array"),
  encode: (value) => value,
});
