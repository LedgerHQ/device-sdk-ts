import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import {
  compileTransactionMessage,
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
  type TransactionMessageWithLifetime,
} from "@solana/transaction-messages";

// `TransactionMessage` is a union across legacy/v0/v1; intersecting with the
// literal `version: 1` narrows it to the v1 member so `instructions` resolves
// to a concrete array type instead of a union of incompatible overloads.
export type DecompiledV1Message = TransactionMessage &
  TransactionMessageWithFeePayer &
  TransactionMessageWithLifetime & { version: 1 };

const compiledTransactionMessageDecoder =
  getCompiledTransactionMessageDecoder();

/**
 * Decodes a SIMD-0385 v1 transaction (bare message or full transaction, base64)
 * into a decompiled, instruction-based message ready for mutation.
 *
 * The underlying decoder ignores any trailing bytes after the message, so
 * this works unmodified whether the input carries trailing signatures or
 * not — unlike the legacy/v0 `deserializeToMessage`, there is no need to
 * separately try a "full transaction" vs. "bare message" shape here: craft
 * always drops signatures on output regardless of what it was given.
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
