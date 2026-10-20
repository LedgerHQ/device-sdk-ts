import {
  type CompiledTransactionMessage,
  getCompiledTransactionMessageDecoder,
} from "@solana/transaction-messages";

const SIGNATURE_LENGTH = 64;

// SIMD-0385 "Transaction V1" wire format: VersionByte(0x81) is unsupported by
// @solana/web3.js, so every message boundary is decoded via
// @solana/transaction-messages instead (a lightweight, officially-maintained
// sub-package of the Solana Kit ecosystem). Its decoder ignores any trailing
// bytes and just reports how far it read (it can even report past the end of a
// truncated buffer), so full-wire vs. bare-message detection stays our own
// concern: an interpretation only counts when it ends exactly at the input end.
const V1_VERSION_BYTE = 0x81;
// A versioned message starts with `0x80 | version`; `0x80` alone is v0.
const VERSIONED_MESSAGE_FLAG = 0x80;
const compiledTransactionMessageDecoder =
  getCompiledTransactionMessageDecoder();

export type NormalizedTransactionInput = {
  messageBytes: Uint8Array;
  serializedForTxCheck?: Uint8Array;
};

/**
 * Splits a transaction input into the message bytes sent to the device and,
 * when the input is a full wire-format transaction (`tx.serialize()`), the
 * original blob (used internally to forward co-signer signatures to
 * Transaction Check without re-serialization).
 *
 * A raw message can also look like a full transaction to a lenient decoder
 * (a single-signer message starts with `0x01`, which reads as "one
 * signature"), so detection only accepts an interpretation that decodes to a
 * well-formed message ending exactly at the input end, trying the bare message
 * first.
 *
 * Handles legacy, v0 and v1 (SIMD-0385) transaction formats.
 */
export class TransactionInputNormaliser {
  normalize(bytes: Uint8Array): NormalizedTransactionInput {
    // Neither a bare message nor a well-formed full transaction: truncated or
    // malformed input. A message of another version behind signatures is cut
    // out so its version can be refused; anything else falls back to
    // best-effort pass-through. The signing flow refuses an invalid v1 message
    // before anything reaches the device; for legacy and v0, device-side
    // validation is the safety net.
    return (
      this.detect(bytes) ??
      this.embeddedVersionedMessage(bytes) ?? { messageBytes: bytes }
    );
  }

  /**
   * Strict format detection. Returns `null` when the bytes are neither a
   * well-formed bare message nor a well-formed full transaction.
   */
  detect(bytes: Uint8Array): NormalizedTransactionInput | null {
    return bytes[0] === V1_VERSION_BYTE
      ? this.detectV1(bytes)
      : this.detectLegacyOrV0(bytes);
  }

  private detectLegacyOrV0(
    bytes: Uint8Array,
  ): NormalizedTransactionInput | null {
    if (this.isWellFormedMessage(bytes)) {
      return { messageBytes: bytes };
    }

    // Extract message bytes directly from the raw bytes so the slice is
    // byte-identical to what the loader validates against.
    const { byteLength, value: sigCount } = this.decodeCompactU16(bytes);
    const messageBytes = bytes.subarray(
      byteLength + sigCount * SIGNATURE_LENGTH,
    );
    if (this.isWellFormedMessage(messageBytes, sigCount)) {
      return { messageBytes, serializedForTxCheck: bytes };
    }

    return null;
  }

  /**
   * True when `bytes` are exactly one legacy/v0 message (no missing or
   * trailing bytes) with a consistent header and in-range account indexes,
   * requiring `expectedSigners` signatures when given.
   */
  private isWellFormedMessage(
    bytes: Uint8Array,
    expectedSigners?: number,
  ): boolean {
    let message: CompiledTransactionMessage;
    try {
      const [decoded, end] = compiledTransactionMessageDecoder.read(bytes, 0);
      if (end !== bytes.length) return false;
      message = decoded;
    } catch {
      return false;
    }
    if (message.version === 1) return false;

    const {
      numSignerAccounts,
      numReadonlySignerAccounts,
      numReadonlyNonSignerAccounts,
    } = message.header;
    if (
      expectedSigners !== undefined &&
      numSignerAccounts !== expectedSigners
    ) {
      return false;
    }
    // At least one signer must be writable (the fee payer), which also rules
    // out a message without signers.
    if (
      numReadonlySignerAccounts >= numSignerAccounts ||
      numSignerAccounts + numReadonlyNonSignerAccounts >
        message.staticAccounts.length
    ) {
      return false;
    }

    const lookups =
      message.version === 0 ? (message.addressTableLookups ?? []) : [];
    const accountCount = lookups.reduce(
      (count, lookup) =>
        count + lookup.writableIndexes.length + lookup.readonlyIndexes.length,
      message.staticAccounts.length,
    );
    return message.instructions.every(
      (instruction) =>
        instruction.programAddressIndex < accountCount &&
        (instruction.accountIndices ?? []).every(
          (index) => index < accountCount,
        ),
    );
  }

  /**
   * For signature-prefixed input that no format matched, returns the bytes
   * after the signatures when they start with a version other than legacy or
   * v0 (v1 in a non-standard layout, or a version the signer does not know)
   * followed by a signer count equal to the signature count. Passing the whole
   * input through would hide that version behind the signature count, which
   * reads as a legacy message, so the version check could not refuse it.
   *
   * A malformed bare legacy message can match by chance (its account keys
   * hold the "version" and "signer count"); it is then refused as an
   * unsupported version instead of by the device. A valid one never gets here.
   */
  private embeddedVersionedMessage(
    bytes: Uint8Array,
  ): NormalizedTransactionInput | null {
    // Below 0x80, the signature count is a single compact-u16 byte.
    const sigCount = bytes[0];
    if (
      sigCount === undefined ||
      sigCount === 0 ||
      (sigCount & VERSIONED_MESSAGE_FLAG) !== 0
    ) {
      return null;
    }
    const messageBytes = bytes.subarray(1 + sigCount * SIGNATURE_LENGTH);
    const [versionByte, signerCount] = messageBytes;
    if (
      versionByte === undefined ||
      (versionByte & VERSIONED_MESSAGE_FLAG) === 0 ||
      versionByte === VERSIONED_MESSAGE_FLAG ||
      signerCount !== sigCount
    ) {
      return null;
    }
    return { messageBytes };
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

  private detectV1(bytes: Uint8Array): NormalizedTransactionInput | null {
    const messageEnd = this.decodeV1MessageEnd(bytes);
    if (messageEnd === null) {
      return null;
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

    return null;
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
