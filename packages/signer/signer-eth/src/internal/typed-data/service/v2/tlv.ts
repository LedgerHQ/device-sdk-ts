// TLV writer for the EIP-712 V2 payloads, matching the encoding the Ethereum app's TLV
// library parses: a single-byte tag, a DER-encoded length, then the value.
// See packages/signer/signer-solana/src/internal/app-binder/clear-sign/tlv.ts for the
// reader side of the same format.

/** Bit 7 of a DER length head byte: set ⇒ long form, clear ⇒ short form (X.690 §8.1.3). */
const LONG_FORM_FLAG = 0x80;
/** Long-form head byte announcing one length byte. */
const ONE_LENGTH_BYTE = 0x81;
/** Long-form head byte announcing two length bytes. */
const TWO_LENGTH_BYTES = 0x82;
/**
 * The transport prefixes the whole payload with a 16-bit length, so nothing inside it can
 * be longer than that. Keeping the writer at two length bytes therefore loses nothing.
 */
const MAX_VALUE_LENGTH = 0xffff;

/** Concatenate byte arrays in one allocation. */
export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** Encode one TLV record. Nested payloads routinely exceed the short form, hence the DER length. */
export function encodeTlv(tag: number, value: Uint8Array): Uint8Array {
  if (value.length > MAX_VALUE_LENGTH) {
    throw new Error(
      `TLV value for tag 0x${tag.toString(16)} is ${value.length} bytes, over the ${MAX_VALUE_LENGTH} byte limit`,
    );
  }

  let header: Uint8Array;
  if (value.length < LONG_FORM_FLAG) {
    header = new Uint8Array([tag, value.length]);
  } else if (value.length <= 0xff) {
    header = new Uint8Array([tag, ONE_LENGTH_BYTE, value.length]);
  } else {
    header = new Uint8Array([
      tag,
      TWO_LENGTH_BYTES,
      value.length >> 8,
      value.length & 0xff,
    ]);
  }

  return concatBytes([header, value]);
}

/** Encode a TLV record holding an unsigned integer, on as few bytes as hold it. */
export function encodeTlvUInt(tag: number, value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `TLV value for tag 0x${tag.toString(16)} must be a non-negative integer, got ${value}`,
    );
  }

  // Zero is the one value whose minimal encoding is not its significant bytes: it has none,
  // and an empty payload means something else in this format (a dynamic array dimension).
  const bytes: number[] = [];
  let remaining = value;
  do {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 0x100);
  } while (remaining > 0);

  return encodeTlv(tag, new Uint8Array(bytes));
}

/** Encode a TLV record holding an ASCII string. */
export function encodeTlvAscii(tag: number, value: string): Uint8Array {
  return encodeTlv(tag, new TextEncoder().encode(value));
}
