import { type DmkError } from "@ledgerhq/device-management-kit";

/** Raised when a descriptor TLV runs past the end of its buffer. */
export class TruncatedDescriptorError implements DmkError {
  readonly _tag = "TruncatedDescriptorError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(
      `Truncated clear-sign descriptor: ${message}`,
    );
  }
}

/** Raised when an INSTRUCTION_INFO TLV lacks a mandatory field. */
export class MissingInstructionFieldError implements DmkError {
  readonly _tag = "MissingInstructionFieldError";
  readonly originalError: Error;

  constructor(field: string) {
    this.originalError = new Error(
      `INSTRUCTION_INFO is missing mandatory field: ${field}.`,
    );
  }
}

/** Raised when decoding the instruction data against the type pool fails. */
export class RequirementsDecodeError implements DmkError {
  readonly _tag = "RequirementsDecodeError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

export type RequirementsError =
  | TruncatedDescriptorError
  | MissingInstructionFieldError
  | RequirementsDecodeError;

/**
 * Internal exception used to unwind the recursive TLV parsers; caught at the
 * public boundary and surfaced as a `Left`. Never escapes the module.
 */
export class RequirementsThrow extends Error {
  constructor(readonly error: RequirementsError) {
    super(error.originalError.message);
    this.name = "RequirementsThrow";
  }
}

export function fail(error: RequirementsError): never {
  throw new RequirementsThrow(error);
}
