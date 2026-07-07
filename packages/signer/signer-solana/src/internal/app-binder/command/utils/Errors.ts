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

const U16_MAX = 0xffff;

/**
 * Thrown by `frameClearSignPayload` when a body is too large to be described by
 * the 2-byte big-endian length prefix the PROVIDE commands expect (> 0xFFFF).
 * Fails fast rather than silently truncating the length into a malformed frame.
 */
export class PayloadTooLargeForLengthPrefixError
  extends Error
  implements DmkError
{
  readonly _tag = "PayloadTooLargeForLengthPrefixError";
  readonly bodyLength: number;

  constructor(bodyLength: number) {
    super(
      `Clear-sign payload too large for u16 length prefix: ${bodyLength} > ${U16_MAX} bytes`,
    );
    this.name = "PayloadTooLargeForLengthPrefixError";
    this.bodyLength = bodyLength;
  }
}
