// DER Tag-Length-Value reader shared by the clear-sign sub-modules. Throws a
// neutral TlvParseError that each caller maps to its own typed error.

export type TlvEntry = { tag: number; value: Uint8Array };

export class TlvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TlvParseError";
  }
}

// DER length encoding constants (X.690 §8.1.3).
/** Bit 7 of the length head byte: set ⇒ long form, clear ⇒ short form. */
const LONG_FORM_FLAG = 0x80;
/** Low 7 bits of a long-form head byte hold the number of length bytes. */
const LENGTH_SIZE_MASK = 0x7f;
/** Cap on long-form length bytes; 4 keeps the result a JS safe integer. */
const MAX_LENGTH_BYTES = 4;
const BYTE_RADIX = 256;

/** Decode a DER-encoded length at `offset`; returns `[length, nextOffset]`. */
function decodeLength(buffer: Uint8Array, offset: number): [number, number] {
  if (offset >= buffer.length) {
    throw new TlvParseError("truncated TLV length byte");
  }
  const head = buffer[offset]!;
  offset += 1;
  if (head < LONG_FORM_FLAG) {
    return [head, offset];
  }
  const lengthSize = head & LENGTH_SIZE_MASK;
  if (lengthSize === 0) {
    throw new TlvParseError("indefinite-length form not allowed");
  }
  // Cap the number of length bytes so an attacker can't make us iterate huge
  // counts and so the result stays within JS safe-integer range (IEEE-754).
  if (lengthSize > MAX_LENGTH_BYTES) {
    throw new TlvParseError("extended TLV length too large");
  }
  if (offset + lengthSize > buffer.length) {
    throw new TlvParseError("truncated extended TLV length");
  }
  let length = 0;
  for (let i = 0; i < lengthSize; i++) {
    length = length * BYTE_RADIX + buffer[offset + i]!;
  }
  return [length, offset + lengthSize];
}

/** Parse every `(tag, value)` record in `buffer`, in stream order. */
export function readTlvEntries(buffer: Uint8Array): TlvEntry[] {
  const entries: TlvEntry[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer[offset]!;
    const [length, afterLength] = decodeLength(buffer, offset + 1);
    if (afterLength + length > buffer.length) {
      throw new TlvParseError("truncated TLV value");
    }
    entries.push({
      tag,
      value: buffer.subarray(afterLength, afterLength + length),
    });
    offset = afterLength + length;
  }
  return entries;
}

/** First value tagged `tag`, or `undefined`. */
export function firstTag(
  entries: TlvEntry[],
  tag: number,
): Uint8Array | undefined {
  return entries.find((entry) => entry.tag === tag)?.value;
}

/** First byte of the first value tagged `tag`, or `undefined` (for `uint8` fields). */
export function firstU8(entries: TlvEntry[], tag: number): number | undefined {
  const value = firstTag(entries, tag);
  return value !== undefined && value.length > 0 ? value[0]! : undefined;
}
