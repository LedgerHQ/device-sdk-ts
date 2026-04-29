import { type DmkError } from "@ledgerhq/device-management-kit";

export class BackupSerializationError implements DmkError {
  readonly _tag = "BackupSerializationError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class BackupDeserializationError implements DmkError {
  readonly _tag = "BackupDeserializationError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}
