import { type DmkError } from "@ledgerhq/device-management-kit";

export class InitRestoreAppStorageError implements DmkError {
  readonly _tag = "InitRestoreAppStorageError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class RestoreAppStorageError implements DmkError {
  readonly _tag = "RestoreAppStorageError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class CommitRestoreAppStorageError implements DmkError {
  readonly _tag = "CommitRestoreAppStorageError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export type RestoreAppsStorageDeviceActionErrors =
  | InitRestoreAppStorageError
  | RestoreAppStorageError
  | CommitRestoreAppStorageError;
