import { VersionedTransaction } from "@solana/web3.js";

const SIGNATURE_LENGTH = 64;

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
 */
export class TransactionInputNormaliser {
  normalize(bytes: Uint8Array): NormalizedTransactionInput {
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
}
