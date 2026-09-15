import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import {
  compileTransactionMessage,
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
  type TransactionMessageWithLifetime,
} from "@solana/transaction-messages";

const SIGNATURE_LENGTH = 64;

// `TransactionMessage` is a union across legacy/v0/v1; intersecting with the
// literal `version: 1` narrows it to the v1 member so `instructions` resolves
// to a concrete array type instead of a union of incompatible overloads.
export type DecompiledV1Message = TransactionMessage &
  TransactionMessageWithFeePayer &
  TransactionMessageWithLifetime & { version: 1 };

const compiledTransactionMessageDecoder =
  getCompiledTransactionMessageDecoder();
const compiledTransactionMessageEncoder =
  getCompiledTransactionMessageEncoder();

/**
 * Decodes a SIMD-0385 v1 transaction (bare message or full transaction, base64)
 * into a decompiled, instruction-based message ready for mutation.
 *
 * The underlying decoder ignores any trailing bytes after the message, so
 * this works unmodified whether the input carries trailing signatures or
 * not — unlike the legacy/v0 `deserializeToMessage`, there is no need to
 * separately try a "full transaction" vs. "bare message" shape here just to
 * read the message. `isV1FullTransaction` below still tells them apart, for
 * the crafter to decide whether to re-wrap its output.
 *
 * Throws when the input is not valid base64, or does not decode as a v1
 * message.
 */
export function deserializeV1ToMessage(
  transactionBase64: string,
): DecompiledV1Message {
  const bytes = base64StringToBuffer(transactionBase64);
  if (bytes === null) {
    throw new Error("Input is not a valid base64 string.");
  }

  try {
    const compiled = compiledTransactionMessageDecoder.decode(bytes);
    return decompileTransactionMessage(compiled) as DecompiledV1Message;
  } catch (error) {
    throw new Error(
      "Input is neither a valid serialized v1 message nor a valid serialized v1 transaction.",
      { cause: error },
    );
  }
}

// Re-exported for the crafter, which needs to recompile the mutated message.
export { compileTransactionMessage };

/**
 * True when `transactionBase64` decodes as a full v1 transaction (message +
 * signatures) rather than a bare v1 message. Used by the crafter to decide
 * whether to re-wrap the crafted message with placeholder signatures on
 * output, mirroring the shape it was given.
 *
 * v1 has no leading shortvec signature-count field (unlike legacy/v0):
 * numRequiredSignatures lives at byte 1 of the message itself, and a full
 * transaction is just that many 64-byte signature slots appended after the
 * message with no extra framing. So a full transaction is detected here by
 * re-encoding the decoded message and checking for exactly that much
 * trailing data — not merely "any" trailing data, since the decoder ignores
 * arbitrary trailing bytes too.
 */
export function isV1FullTransaction(transactionBase64: string): boolean {
  const bytes = base64StringToBuffer(transactionBase64);
  if (bytes === null) {
    return false;
  }

  try {
    const compiled = compiledTransactionMessageDecoder.decode(bytes);
    const messageBytes = new Uint8Array(
      compiledTransactionMessageEncoder.encode(compiled),
    );
    if (
      bytes.length <= messageBytes.length ||
      !bytesEqual(bytes.subarray(0, messageBytes.length), messageBytes)
    ) {
      return false;
    }

    const numRequiredSignatures = messageBytes[1] ?? 0;
    const trailingLength = bytes.length - messageBytes.length;
    return trailingLength === numRequiredSignatures * SIGNATURE_LENGTH;
  } catch {
    return false;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
