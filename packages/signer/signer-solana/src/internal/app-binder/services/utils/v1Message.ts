import {
  getCompiledTransactionMessageDecoder,
  TRANSACTION_CONFIG_COMPUTE_UNIT_LIMIT_BIT_MASK,
  TRANSACTION_CONFIG_HEAP_SIZE_BIT_MASK,
  TRANSACTION_CONFIG_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT_MASK,
  TRANSACTION_CONFIG_PRIORITY_FEE_LAMPORTS_BIT_MASK,
  type V1CompiledTransactionMessage,
} from "@solana/transaction-messages";
import { type Either, Left, Right } from "purify-ts";

// Solana transaction v1 (SIMD-0385) message validation. The Kit decoder reads
// the layout but checks almost nothing: it accepts unknown config bits,
// duplicate addresses, out-of-range indexes and trailing bytes. This module
// adds every validity rule of the v1 spec that applies to a message, so a
// message it accepts is one the chain and the device accept too.

export const V1_VERSION_BYTE = 0x81;

const CONFIG_MASK_OFFSET = 4;
const KNOWN_CONFIG_BITS =
  TRANSACTION_CONFIG_PRIORITY_FEE_LAMPORTS_BIT_MASK |
  TRANSACTION_CONFIG_COMPUTE_UNIT_LIMIT_BIT_MASK |
  TRANSACTION_CONFIG_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT_MASK |
  TRANSACTION_CONFIG_HEAP_SIZE_BIT_MASK;

const MAX_SIGNATURES = 12;
const MAX_INSTRUCTIONS = 64;
const MAX_ADDRESSES = 64;
const MIN_HEAP_SIZE = 32 * 1024;
const MAX_HEAP_SIZE = 256 * 1024;
const HEAP_SIZE_STEP = 1024;
const MAX_TRANSACTION_SIZE = 4096;
const SIGNATURE_LENGTH = 64;

/** The spec rule a v1 message breaks. */
export type V1Rule =
  | "VERSION"
  | "TRUNCATED"
  | "CONFIG_MASK"
  | "TRAILING_BYTES"
  | "READONLY_SIGNERS"
  | "SIGNATURE_COUNT"
  | "INSTRUCTION_COUNT"
  | "ADDRESS_COUNT"
  | "DUPLICATE_ADDRESS"
  | "HEAP_SIZE"
  | "PROGRAM_INDEX"
  | "ACCOUNT_INDEX"
  | "MESSAGE_SIZE";

export type V1ValidationFailure = {
  rule: V1Rule;
  detail: string;
};

export type DecodedV1Message = V1CompiledTransactionMessage;

const decoder = getCompiledTransactionMessageDecoder();

const failure = (rule: V1Rule, detail: string): V1ValidationFailure => ({
  rule,
  detail,
});

/**
 * Decodes a v1 message (signatures already split off) and checks it against
 * every message rule of the v1 spec. Returns the first rule it breaks.
 *
 * The version byte and the config mask are checked on the raw bytes before
 * decoding: Kit reads no value for an unknown config bit, so its end offset
 * cannot be trusted until the mask is known to be valid. After that, any
 * decoder throw means the buffer ended early.
 */
export function decodeV1Message(
  bytes: Uint8Array,
): Either<V1ValidationFailure, DecodedV1Message> {
  if (bytes[0] !== V1_VERSION_BYTE) {
    return Left(
      failure("VERSION", `First byte is ${toHex(bytes[0])}, expected 0x81.`),
    );
  }
  if (bytes.length < CONFIG_MASK_OFFSET + 4) {
    return Left(
      failure(
        "TRUNCATED",
        `Message ends at byte ${bytes.length}, in the header.`,
      ),
    );
  }

  const maskFailure = checkConfigMask(readU32LE(bytes, CONFIG_MASK_OFFSET));
  if (maskFailure) return Left(maskFailure);

  let message;
  let end;
  try {
    [message, end] = decoder.read(bytes, 0);
  } catch (error) {
    return Left(
      failure(
        "TRUNCATED",
        error instanceof Error ? error.message : "Message ends early.",
      ),
    );
  }
  if (message.version !== 1) {
    return Left(failure("VERSION", `Decoded version ${message.version}.`));
  }
  if (end !== bytes.length) {
    return Left(
      failure(
        "TRAILING_BYTES",
        `Message ends at byte ${end}, followed by ${bytes.length - end} more.`,
      ),
    );
  }

  const fieldFailure = checkFields(message, bytes.length);
  return fieldFailure ? Left(fieldFailure) : Right(message);
}

function checkConfigMask(mask: number): V1ValidationFailure | null {
  if ((mask & ~KNOWN_CONFIG_BITS) !== 0) {
    return failure(
      "CONFIG_MASK",
      `Unknown config bits in mask ${toHex(mask)}.`,
    );
  }
  const priorityFeeBits =
    mask & TRANSACTION_CONFIG_PRIORITY_FEE_LAMPORTS_BIT_MASK;
  if (
    priorityFeeBits !== 0 &&
    priorityFeeBits !== TRANSACTION_CONFIG_PRIORITY_FEE_LAMPORTS_BIT_MASK
  ) {
    return failure(
      "CONFIG_MASK",
      `Priority-fee bits 0 and 1 differ in mask ${toHex(mask)}.`,
    );
  }
  return null;
}

function checkFields(
  message: DecodedV1Message,
  length: number,
): V1ValidationFailure | null {
  const {
    numSignerAccounts,
    numReadonlySignerAccounts,
    numReadonlyNonSignerAccounts,
  } = message.header;
  const numAddresses = message.staticAccounts.length;

  if (numReadonlySignerAccounts >= numSignerAccounts) {
    return failure(
      "READONLY_SIGNERS",
      `${numReadonlySignerAccounts} readonly signers for ${numSignerAccounts} signers.`,
    );
  }
  if (numSignerAccounts > MAX_SIGNATURES) {
    return failure(
      "SIGNATURE_COUNT",
      `${numSignerAccounts} signers, at most ${MAX_SIGNATURES}.`,
    );
  }
  if (message.numInstructions > MAX_INSTRUCTIONS) {
    return failure(
      "INSTRUCTION_COUNT",
      `${message.numInstructions} instructions, at most ${MAX_INSTRUCTIONS}.`,
    );
  }
  if (numAddresses > MAX_ADDRESSES) {
    return failure(
      "ADDRESS_COUNT",
      `${numAddresses} addresses, at most ${MAX_ADDRESSES}.`,
    );
  }
  if (numAddresses < numSignerAccounts + numReadonlyNonSignerAccounts) {
    return failure(
      "ADDRESS_COUNT",
      `${numAddresses} addresses for ${numSignerAccounts} signers and ${numReadonlyNonSignerAccounts} readonly non-signers.`,
    );
  }
  if (new Set(message.staticAccounts).size !== numAddresses) {
    return failure("DUPLICATE_ADDRESS", "Addresses are not all distinct.");
  }

  if ((message.configMask & TRANSACTION_CONFIG_HEAP_SIZE_BIT_MASK) !== 0) {
    // Config values are decoded in bit order, so the heap size is last.
    const heapSize = message.configValues[message.configValues.length - 1];
    if (
      heapSize?.kind !== "u32" ||
      heapSize.value % HEAP_SIZE_STEP !== 0 ||
      heapSize.value < MIN_HEAP_SIZE ||
      heapSize.value > MAX_HEAP_SIZE
    ) {
      return failure(
        "HEAP_SIZE",
        `Heap size ${heapSize?.value} is not a multiple of ${HEAP_SIZE_STEP} in [${MIN_HEAP_SIZE}, ${MAX_HEAP_SIZE}].`,
      );
    }
  }

  for (const [i, header] of message.instructionHeaders.entries()) {
    const { programAccountIndex } = header;
    if (programAccountIndex === 0 || programAccountIndex >= numAddresses) {
      return failure(
        "PROGRAM_INDEX",
        `Instruction ${i} program index ${programAccountIndex}, expected 1 to ${numAddresses - 1}.`,
      );
    }
    const accountIndex = message.instructionPayloads[
      i
    ]?.instructionAccountIndices.find((index) => index >= numAddresses);
    if (accountIndex !== undefined) {
      return failure(
        "ACCOUNT_INDEX",
        `Instruction ${i} account index ${accountIndex}, expected below ${numAddresses}.`,
      );
    }
  }

  const transactionSize = length + SIGNATURE_LENGTH * numSignerAccounts;
  if (transactionSize > MAX_TRANSACTION_SIZE) {
    return failure(
      "MESSAGE_SIZE",
      `Transaction is ${transactionSize} bytes with its signatures, at most ${MAX_TRANSACTION_SIZE}.`,
    );
  }

  return null;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function toHex(value: number | undefined): string {
  return value === undefined ? "missing" : `0x${value.toString(16)}`;
}
