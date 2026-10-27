/**
 * Minimal protobuf helpers needed to frame a Tron transaction across APDUs.
 *
 * Ported (bug-for-bug) from `@ledgerhq/hw-app-trx` `utils.ts` / `Trx.ts`, but
 * operating on `Uint8Array` instead of node `Buffer`. The Tron app requires
 * each APDU frame to contain whole protobuf fields, so we walk the raw
 * transaction field by field to find safe chunk boundaries.
 */

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

  while (shift < 64) {
    const b = stream[pos]!;
    result |= (b & 0x7f) << shift;
    pos += 1;

    if (!(b & 0x80)) {
      result &= 0xffffffff;
      return { value: result, pos };
    }

    shift += 7;
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
  if ((field.value & 0x07) === 0) {
    return data.pos;
  }
  return data.value + data.pos;
}
