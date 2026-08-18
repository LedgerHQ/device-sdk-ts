import { type DmkError } from "@ledgerhq/device-management-kit";

import { type GetOsVersionError } from "@api/device-action/OsUpdate/Shared/OsUpdateDeviceActionErrors";

export class ResolveMcuVersionError implements DmkError {
  readonly _tag = "ResolveMcuVersionError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export class BootloaderModeTimeoutError implements DmkError {
  readonly _tag = "BootloaderModeTimeoutError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export type FlashMcuDAErrors =
  | GetOsVersionError
  | ResolveMcuVersionError
  | BootloaderModeTimeoutError;
