import { type DmkError } from "@ledgerhq/device-management-kit";

/**
 * The smallest message that can possibly decode is one with no instructions
 * and a single static account key: 3 header bytes + 1 byte for the static-key
 * shortvec count + 32 bytes for the key + 32 bytes for the blockhash + 1 byte
 * for the instruction shortvec count.
 */
export const MIN_MESSAGE_BYTES = 3 + 1 + 32 + 32 + 1;

/**
 * A per-instruction account reference is a u8 index (0..255), so an
 * instruction can address at most 256 distinct keys. Used as a sanity bound
 * on the decoded account-slot count.
 */
export const MAX_ACCOUNTS_PER_INSTRUCTION = 256;

/**
 * The TX-wide account index is a u8 in the wire format.
 */
export const MAX_ACCOUNTS_PER_TX = 256;

export class TruncatedTransactionError implements DmkError {
  readonly _tag = "TruncatedTransactionError";
  readonly originalError: Error;

  constructor(message?: string, originalError?: unknown) {
    this.originalError =
      originalError instanceof Error
        ? originalError
        : new Error(message ?? "Truncated Solana transaction bytes.");
  }
}

export class InvalidVersionError implements DmkError {
  readonly _tag = "InvalidVersionError";
  readonly originalError: Error;

  constructor(version: number, originalError?: unknown) {
    this.originalError =
      originalError instanceof Error
        ? originalError
        : new Error(
            `Unsupported Solana message version 0x${version
              .toString(16)
              .padStart(2, "0")}.`,
          );
  }
}

export class MalformedTransactionError implements DmkError {
  readonly _tag = "MalformedTransactionError";
  readonly originalError: Error;

  constructor(message?: string, originalError?: unknown) {
    this.originalError =
      originalError instanceof Error
        ? originalError
        : new Error(message ?? "Malformed Solana transaction bytes.");
  }
}

export class EmptyInstructionsError implements DmkError {
  readonly _tag = "EmptyInstructionsError";
  readonly originalError: Error;

  constructor() {
    this.originalError = new Error(
      "Solana transaction has no instructions to sign.",
    );
  }
}

export class OversizedAccountArrayError implements DmkError {
  readonly _tag = "OversizedAccountArrayError";
  readonly originalError: Error;

  constructor(instructionIndex: number, accountCount: number) {
    this.originalError = new Error(
      `Instruction ${instructionIndex} declares ${accountCount} accounts, ` +
        `exceeds wire-format limit of ${MAX_ACCOUNTS_PER_INSTRUCTION}.`,
    );
  }
}

export class AccountIndexOutOfRangeError implements DmkError {
  readonly _tag = "AccountIndexOutOfRangeError";
  readonly originalError: Error;

  constructor(
    instructionIndex: number,
    accountSlot: number,
    keyIndex: number,
    keyCount: number,
  ) {
    this.originalError = new Error(
      `Instruction ${instructionIndex} account slot ${accountSlot} references ` +
        `key index ${keyIndex} but only ${keyCount} keys are available.`,
    );
  }
}

export type ParserError =
  | TruncatedTransactionError
  | InvalidVersionError
  | MalformedTransactionError
  | EmptyInstructionsError
  | OversizedAccountArrayError
  | AccountIndexOutOfRangeError;
