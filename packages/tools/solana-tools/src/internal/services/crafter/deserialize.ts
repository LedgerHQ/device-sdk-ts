import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type Message,
  type MessageV0,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Branch on the input kind and return the message to operate on.
 *
 * Accepts either a serialized VersionedMessage (legacy or v0) or a full
 * serialized VersionedTransaction. For a full transaction the signatures are
 * dropped and only `message` is returned: the craft path always recompiles
 * into a fresh message, which carries no signatures.
 *
 * Detection is structural and confirmed by re-serialization. A candidate shape
 * is accepted only when serializing it back produces the original bytes, which
 * tells a bare message apart from a full transaction without guessing from the
 * leading bytes alone.
 *
 * v1 (SIMD-0385) input is refused: web3.js v3 can decode it, but it belongs to
 * `V1TransactionCrafterService`, and recompiling it here would turn it into v0.
 *
 * Throws when the input is not valid base64, or when it matches neither shape.
 */
export function deserializeToMessage(
  transactionBase64: string,
): Message | MessageV0 {
  const bytes = base64StringToBuffer(transactionBase64);
  if (bytes === null) {
    throw new Error("Input is not a valid base64 string.");
  }

  const fromTransaction = tryDeserializeTransaction(bytes);
  if (fromTransaction !== null) {
    return fromTransaction;
  }

  const fromMessage = tryDeserializeMessage(bytes);
  if (fromMessage !== null) {
    return fromMessage;
  }

  throw new Error(
    "Input is neither a valid serialized message nor a valid serialized transaction.",
  );
}

function tryDeserializeTransaction(
  bytes: Uint8Array,
): Message | MessageV0 | null {
  try {
    const transaction = VersionedTransaction.deserialize(bytes);
    if (bytesEqual(transaction.serialize(), bytes)) {
      return legacyOrV0(transaction.message);
    }
  } catch {
    // Not a full transaction, fall through to the bare-message branch.
  }
  return null;
}

function tryDeserializeMessage(bytes: Uint8Array): Message | MessageV0 | null {
  try {
    const message = VersionedMessage.deserialize(bytes);
    if (bytesEqual(message.serialize(), bytes)) {
      return legacyOrV0(message);
    }
  } catch {
    // Not a bare message either.
  }
  return null;
}

/**
 * True when `transactionBase64` decodes as a full serialized transaction
 * (message + signatures) rather than a bare message. Used by the crafter to
 * decide whether to re-wrap the crafted message with placeholder signatures
 * on output, mirroring the shape it was given.
 */
export function isFullTransaction(transactionBase64: string): boolean {
  const bytes = base64StringToBuffer(transactionBase64);
  return bytes !== null && tryDeserializeTransaction(bytes) !== null;
}

function legacyOrV0(message: VersionedMessage): Message | MessageV0 | null {
  return message.version === 1 ? null : message;
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
