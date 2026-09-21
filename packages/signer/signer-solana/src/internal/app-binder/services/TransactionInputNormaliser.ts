import { getCompiledTransactionMessageDecoder } from "@solana/transaction-messages";
import { VersionedTransaction } from "@solana/web3.js";

const SIGNATURE_LENGTH = 64;

// SIMD-0385 "Transaction V1" wire format: VersionByte(0x81) is unsupported by
// @solana/web3.js, so its message boundary is decoded via @solana/transaction-messages
// instead (a lightweight, officially-maintained sub-package of the Solana Kit
// ecosystem). Its decoder ignores any trailing bytes and just reports how far it
// read, so it can be pointed at a buffer that may or may not carry trailing
// signatures — full-wire vs. bare-message detection stays our own concern, same
// as the legacy/v0 branch below.
const V1_VERSION_BYTE = 0x81;
const compiledTransactionMessageDecoder =
  getCompiledTransactionMessageDecoder();

export type NormalizedTransactionInput = {
  messageBytes: Uint8Array;
  serializedForTxCheck?: Uint8Array;
};

/**
 * Detects whether a transaction input is a full wire-format Solana transaction
 * (`tx.serialize()`) or raw message bytes (`tx.serializeMessage()`), and
 * returns the message bytes together with the original blob when it was
 * full wire-format (used internally to forward co-signer signatures to
 * Transaction Check without re-serialization).
 *
 * Handles legacy/v0 (via `@solana/web3.js`) and v1 (SIMD-0385, via
 * `@solana/transaction-messages`, since web3.js does not support it yet)
 * transaction formats.
 */
export class TransactionInputNormaliser {
  normalize(bytes: Uint8Array): NormalizedTransactionInput {
    if (bytes[0] === V1_VERSION_BYTE) {
      return this.normalizeV1(bytes);
    }

    try {
      VersionedTransaction.deserialize(bytes);
    } catch {
      return { messageBytes: bytes };
    }

    // Full wire-format. Extract message bytes directly from the raw bytes so
    // the slice is byte-identical to what the loader validates against.
    const { byteLength, value: sigCount } = this.decodeCompactU16(bytes);
    const messageOffset = byteLength + sigCount * SIGNATURE_LENGTH;
    const messageBytes = bytes.subarray(messageOffset);
    return { messageBytes, serializedForTxCheck: bytes };
  }

  private decodeCompactU16(bytes: Uint8Array): {
    value: number;
    byteLength: number;
  } {
    let value = 0;
    let shift = 0;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return { value, byteLength: i + 1 };
      shift += 7;
    }
    return { value, byteLength: bytes.length };
  }

  private normalizeV1(bytes: Uint8Array): NormalizedTransactionInput {
    const messageEnd = this.decodeV1MessageEnd(bytes);
    if (messageEnd === null) {
      return { messageBytes: bytes };
    }

    if (bytes.length === messageEnd) {
      return { messageBytes: bytes };
    }

    const numRequiredSignatures = bytes[1]!;
    const signaturesLength = numRequiredSignatures * SIGNATURE_LENGTH;
    if (bytes.length === messageEnd + signaturesLength) {
      return {
        messageBytes: bytes.subarray(0, messageEnd),
        serializedForTxCheck: bytes,
      };
    }

    // Neither a bare message nor a well-formed full transaction: truncated or
    // malformed input. Fall back to best-effort pass-through; device-side
    // validation is the safety net, as for any other malformed input.
    return { messageBytes: bytes };
  }

  /**
   * Decodes a v1 message (SIMD-0385) via `@solana/transaction-messages` to
   * find the byte offset immediately after `InstructionPayloads`, i.e. the
   * end of the message and the start of any trailing `Signatures`. The
   * decoder ignores trailing bytes, so this works whether or not signatures
   * follow. Returns `null` if the buffer can't be decoded as a v1 message.
   */
  private decodeV1MessageEnd(bytes: Uint8Array): number | null {
    try {
      const [, offset] = compiledTransactionMessageDecoder.read(bytes, 0);
      return offset;
    } catch {
      return null;
    }
  }
}
