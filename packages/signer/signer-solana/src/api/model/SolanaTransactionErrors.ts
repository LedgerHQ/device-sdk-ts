import { type DmkError } from "@ledgerhq/device-management-kit";

/** The Solana v1 message rule an invalid transaction breaks. */
export type SolanaV1TransactionRule =
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

export const INVALID_SOLANA_TRANSACTION_ERROR_TAG =
  "InvalidSolanaTransactionError";

/**
 * The transaction breaks a validity rule of its message version, so neither
 * the chain nor the device would accept it. Nothing is sent to the device.
 */
export class InvalidSolanaTransactionError implements DmkError {
  readonly _tag = INVALID_SOLANA_TRANSACTION_ERROR_TAG;
  readonly originalError: Error;

  constructor(
    readonly rule: SolanaV1TransactionRule,
    detail: string,
  ) {
    this.originalError = new Error(
      `Invalid Solana v1 transaction (${rule}): ${detail}`,
    );
  }
}
