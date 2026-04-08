import { type DmkError } from "@ledgerhq/device-management-kit";

export class GetBackupError implements DmkError {
  readonly _tag = "GetBackupError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class SaveBackupError implements DmkError {
  readonly _tag = "SaveBackupError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}
