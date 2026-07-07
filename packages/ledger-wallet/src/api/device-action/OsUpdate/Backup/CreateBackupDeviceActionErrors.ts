import { type DmkError } from "@ledgerhq/device-management-kit";

export class GetLanguageIdError implements DmkError {
  readonly _tag = "GetLanguageIdError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class GetIsOnboardedError implements DmkError {
  readonly _tag = "GetIsOnboardedError";
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

export type CreateBackupDeviceActionErrors =
  | GetLanguageIdError
  | GetIsOnboardedError
  | BackupAppsStorageError;
