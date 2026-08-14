import { type DmkError } from "@ledgerhq/device-management-kit";

export class GetOsVersionError implements DmkError {
  readonly _tag = "GetOsVersionError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}
