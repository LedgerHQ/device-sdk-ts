import { type DmkError } from "@ledgerhq/device-management-kit";

import { type GetOsVersionError } from "@api/device-action/OsUpdate/Shared/SharedDeviceActionErrors";

export class ResolveOsUpdatePathError implements DmkError {
  readonly _tag = "ResolveOsUpdatePathError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

export type ResolveOsUpdatePathDAErrors =
  | GetOsVersionError
  | ResolveOsUpdatePathError;
