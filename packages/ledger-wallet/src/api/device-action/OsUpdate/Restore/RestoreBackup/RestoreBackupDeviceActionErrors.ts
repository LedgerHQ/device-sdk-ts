import { type DmkError } from "@ledgerhq/device-management-kit";

export class GetIsOnboardedError implements DmkError {
  readonly _tag = "GetIsOnboardedError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class RequestMasterConsentError implements DmkError {
  readonly _tag = "RequestMasterConsentError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export type RestoreBackupDeviceActionErrors =
  | GetIsOnboardedError
  | RequestMasterConsentError;
