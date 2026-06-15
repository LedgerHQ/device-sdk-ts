import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

import { ChunkTooLargeError } from "./Errors";

export const P2_EXTEND = 0x01;
export const P2_MORE = 0x02;

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

/**
 * Prepend the 2-byte big-endian length prefix the generic clear-signing PROVIDE
 * commands expect (`INSTRUCTION_INFO` 0x24, `INSTRUCTION_SUBSTRUCTURE` 0x25,
 * `ENUM_VARIANT` 0x26, `TOKEN_INFO` 0x22, `TOKEN_ACCOUNT_STATE` 0x27,
 * `ALT_RESOLUTION` 0x28, `TRUSTED_NAME` 0x21). The length covers everything
 * after the prefix; the framed payload is then split with {@link buildChunkP2}
 * so the prefix lands in the first chunk. When `typeByte` is provided
 * (substructures) it is the first byte of the body and counted in the length.
 *
 * Note: the chunking itself is unchanged from every other Solana command, this
 * only adds the per-command length prefix, which the generic preview / prompt /
 * delayed APDUs do not use.
 */
export function frameClearSignPayload(
  tlv: Uint8Array,
  typeByte?: number,
): Uint8Array {
  const bodyLength = tlv.length + (typeByte === undefined ? 0 : 1);
  const framed = new Uint8Array(2 + bodyLength);
  framed[0] = (bodyLength >>> 8) & 0xff;
  framed[1] = bodyLength & 0xff;
  let offset = 2;
  if (typeByte !== undefined) {
    framed[offset] = typeByte & 0xff;
    offset += 1;
  }
  framed.set(tlv, offset);
  return framed;
}
