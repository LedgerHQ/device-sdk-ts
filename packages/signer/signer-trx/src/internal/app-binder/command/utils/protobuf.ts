/**
 * Minimal protobuf helpers needed to frame a Tron transaction across APDUs.
 *
 * Ported (bug-for-bug) from `@ledgerhq/hw-app-trx` `utils.ts` / `Trx.ts`, but
 * operating on `Uint8Array` instead of node `Buffer`. The Tron app requires
 * each APDU frame to contain whole protobuf fields, so we walk the raw
 * transaction field by field to find safe chunk boundaries.
 */

// Base-128 varint bit layout (protobuf).
const VARINT_CONTINUATION_BIT = 0x80; // high bit set => more bytes follow
const VARINT_VALUE_MASK = 0x7f; // low 7 bits carry the value
const VARINT_BITS_PER_BYTE = 7; // value bits contributed by each byte
const MAX_VARINT_BITS = 64; // guard against a non-terminating varint
const UINT32_MASK = 0xffffffff; // clamp the decoded value to 32 bits
const WIRE_TYPE_MASK = 0x07; // low 3 bits of a field key hold the wire type
const WIRE_TYPE_VARINT = 0; // wire type 0 => varint field (no payload length)

type DecodeResult = {
  value: number;
  pos: number;
};

/**
 * Decode a base-128 varint starting at `index`.
 *
 * @returns the decoded value and the position immediately after the varint
 */
export function decodeVarint(stream: Uint8Array, index: number): DecodeResult {
  let result = 0;
  let shift = 0;
  let pos = index;

  while (shift < MAX_VARINT_BITS) {
    const b = stream[pos]!;
    result |= (b & VARINT_VALUE_MASK) << shift;
    pos += 1;

    if (!(b & VARINT_CONTINUATION_BIT)) {
      result &= UINT32_MASK;
      return { value: result, pos };
    }

    shift += VARINT_BITS_PER_BYTE;
  }

  throw new Error("Too many bytes when decoding varint.");
}

/**
 * Given a raw transaction buffer positioned at the start of a protobuf field,
 * return the byte length of that whole field (key + payload). Varint-typed
 * fields (wire type 0) are just the two varints; length-delimited fields add
 * their declared length.
 */
export function getNextLength(tx: Uint8Array): number {
  const field = decodeVarint(tx, 0);
  const data = decodeVarint(tx, field.pos);
  if ((field.value & WIRE_TYPE_MASK) === WIRE_TYPE_VARINT) {
    return data.pos;
  }
  return data.value + data.pos;
}
