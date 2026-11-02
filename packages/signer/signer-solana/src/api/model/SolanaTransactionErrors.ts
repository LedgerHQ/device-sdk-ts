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

/**
 * Why a transaction version is refused:
 * - `unknownVersion`: no Solana app supports it (version 2 and above).
 * - `appVersion`: the connected Solana app is too old for it.
 */
export type SolanaTransactionVersionNotSupportedReason =
  | "unknownVersion"
  | "appVersion";

export const SOLANA_TRANSACTION_VERSION_NOT_SUPPORTED_ERROR_TAG =
  "SolanaTransactionVersionNotSupportedError";
export const INVALID_SOLANA_TRANSACTION_ERROR_TAG =
  "InvalidSolanaTransactionError";

/**
 * The transaction uses a message version the signer refuses, before anything
 * is sent to the device.
 */
export class SolanaTransactionVersionNotSupportedError implements DmkError {
  readonly _tag = SOLANA_TRANSACTION_VERSION_NOT_SUPPORTED_ERROR_TAG;
  readonly originalError: Error;

  constructor(
    readonly version: number,
    readonly reason: SolanaTransactionVersionNotSupportedReason,
  ) {
    this.originalError = new Error(
      reason === "appVersion"
        ? `Solana transaction version ${version} is not supported by this Solana app version. Update the Solana app.`
        : `Solana transaction version ${version} is not supported.`,
    );
  }
}

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

// The guards are structural (`_tag`) rather than `instanceof`, for the same
// dual-package reason as `isSolanaAppError`.

export const isSolanaTransactionVersionNotSupportedError = (
  error: unknown,
): error is SolanaTransactionVersionNotSupportedError =>
  typeof error === "object" &&
  error !== null &&
  (error as { _tag?: unknown })._tag ===
    SOLANA_TRANSACTION_VERSION_NOT_SUPPORTED_ERROR_TAG &&
  typeof (error as { version?: unknown }).version === "number";

export const isInvalidSolanaTransactionError = (
  error: unknown,
): error is InvalidSolanaTransactionError =>
  typeof error === "object" &&
  error !== null &&
  (error as { _tag?: unknown })._tag === INVALID_SOLANA_TRANSACTION_ERROR_TAG &&
  typeof (error as { rule?: unknown }).rule === "string";
