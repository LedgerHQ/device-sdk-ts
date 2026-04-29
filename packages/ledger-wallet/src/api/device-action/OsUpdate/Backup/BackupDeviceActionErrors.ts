import { type DmkError } from "@ledgerhq/device-management-kit";

export class LookForBackupError implements DmkError {
  readonly _tag = "LookForBackupError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class GetLanguageIdError implements DmkError {
  readonly _tag = "GetLanguageIdError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class BackupAppsStorageError implements DmkError {
  readonly _tag = "BackupAppsStorageError";
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

export type BackupDeviceActionErrors =
  | LookForBackupError
  | GetLanguageIdError
  | BackupAppsStorageError
  | SaveBackupError;
