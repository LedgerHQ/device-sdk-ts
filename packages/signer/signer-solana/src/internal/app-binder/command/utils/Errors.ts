import {
  APDU_MAX_PAYLOAD,
  type DmkError,
} from "@ledgerhq/device-management-kit";

/**
 * Thrown by `assertChunkSize` when the caller passes a payload that exceeds
 * the short-APDU data limit.
 */
export class ChunkTooLargeError extends Error implements DmkError {
  readonly _tag = "ChunkTooLargeError";
  readonly ins: number;
  readonly payloadSize: number;

  constructor(payloadSize: number, ins: number) {
    super(
      `Chunk too large for short APDU (INS=0x${ins
        .toString(16)
        .padStart(2, "0")}): ${payloadSize} > ${APDU_MAX_PAYLOAD}`,
    );
    this.name = "ChunkTooLargeError";
    this.ins = ins;
    this.payloadSize = payloadSize;
  }
}
