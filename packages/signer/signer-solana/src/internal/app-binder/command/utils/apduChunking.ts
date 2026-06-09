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
