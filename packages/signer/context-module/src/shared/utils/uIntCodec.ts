import { Codec, Left, Right } from "purify-ts";

/**
 * Factory for an unsigned N-bit integer codec (0..=2^bits-1). Decodes only
 * finite integers in that range; everything else (floats, negatives,
 * non-numbers, NaN) returns Left.
 */
export const uIntCodec = (bits: number) => {
  const max = 2 ** bits - 1;
  return Codec.custom<number>({
    decode: (value) =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= max
        ? Right(value)
        : Left(`Expected a u${bits} integer (0..=${max})`),
    encode: (value) => value,
  });
};

/**
 * Codec for an unsigned 8-bit integer (0..=255).
 *
 * Used for byte-wide TLV fields like ALT entry indices.
 */
export const u8Codec = uIntCodec(8);

/**
 * Codec for an unsigned 16-bit integer (0..=65535).
 *
 * Used for the enum-variant index, which can range over a uint16.
 */
export const u16Codec = uIntCodec(16);
