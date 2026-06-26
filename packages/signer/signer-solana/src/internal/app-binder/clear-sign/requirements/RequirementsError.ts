import { type DmkError } from "@ledgerhq/device-management-kit";

/** Raised when building requirements from a CAL descriptor fails. */
export class RequirementsDecodeError implements DmkError {
  readonly _tag = "RequirementsDecodeError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

export type RequirementsError = RequirementsDecodeError;
