import { type DmkError } from "@ledgerhq/device-management-kit";

/** Raised when building requirements from a CAL descriptor fails. */
export class RequirementsDecodeError implements DmkError {
  readonly _tag = "RequirementsDecodeError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

/**
 * Raised when an instruction's live accounts fail its CAL `ACCOUNT_SCHEMA`
 * check (the host pre-check for a stale/incompatible descriptor). Kept
 * distinct from {@link RequirementsDecodeError} so callers can tell "the CAL
 * descriptor is malformed" apart from "the descriptor is stale for this
 * instruction" and report the latter as a distinct blind-sign reason.
 */
export class AccountSchemaMismatchError implements DmkError {
  readonly _tag = "AccountSchemaMismatchError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

export type RequirementsError =
  | RequirementsDecodeError
  | AccountSchemaMismatchError;
