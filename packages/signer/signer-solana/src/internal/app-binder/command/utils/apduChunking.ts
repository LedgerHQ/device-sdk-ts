import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

import { ChunkTooLargeError } from "./Errors";

export const P2_EXTEND = 0x01;
export const P2_MORE = 0x02;

/**
 * TLV tag for the DER `SIGNATURE` record carried by the `INSTRUCTION_INFO`
 * (0x24) and `ENUM_VARIANT` (0x26) descriptors (`tlv_structs.md`).
 */
export const CLEAR_SIGN_SIGNATURE_TAG = 0x15;

/**
 * DER-encode a non-negative TLV length: short form for `< 0x80`, otherwise
 * `0x80 | n` followed by the `n` big-endian length bytes.
 */
function encodeDerLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const body: number[] = [];
  for (let v = length; v > 0; v >>>= 8) body.unshift(v & 0xff);
  return Uint8Array.of(0x80 | body.length, ...body);
}

/**
 * Append the DER signature as a `SIGNATURE` (0x15) TLV record to a descriptor's
 * TLV bytes.
 *
 * CAL serves the descriptor `data` unsigned — a single blob with separate
 * prod/test signatures over it — so the host appends the picked signature as
 * the trailing record before framing and streaming, so the device can verify it.
 * Used for `INSTRUCTION_INFO` (0x24) and `ENUM_VARIANT` (0x26),
 * which carry the signature inline (unlike `TOKEN_INFO` 0x22,
 * whose command appends its own 0x08 signature record).
 */
export function appendSignatureTlv(
  tlv: Uint8Array,
  signature: Uint8Array,
): Uint8Array {
  const lengthBytes = encodeDerLength(signature.length);
  const record = new Uint8Array(1 + lengthBytes.length + signature.length);
  record[0] = CLEAR_SIGN_SIGNATURE_TAG;
  record.set(lengthBytes, 1);
  record.set(signature, 1 + lengthBytes.length);

  const signed = new Uint8Array(tlv.length + record.length);
  signed.set(tlv, 0);
  signed.set(record, tlv.length);
  return signed;
}

/**
 * Compute the P2 byte for a chunked Solana APDU.
 *
 * Single chunk:  0x00
 * First of many: P2_MORE
 * Middle:        P2_MORE | P2_EXTEND
 * Last:          P2_EXTEND
 */
export function buildChunkP2(isFirstChunk: boolean, hasMore: boolean): number {
  let p2 = 0x00;
  if (!isFirstChunk) p2 |= P2_EXTEND;
  if (hasMore) p2 |= P2_MORE;
  return p2;
}

/**
 * Throws `ChunkTooLargeError` when a chunk is larger than a single
 * APDU payload can carry.
 */
export function assertChunkSize(payload: Uint8Array, ins: number): void {
  if (payload.length > APDU_MAX_PAYLOAD) {
    throw new ChunkTooLargeError(payload.length, ins);
  }
}
