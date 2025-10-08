import {
  AppAlreadyInstalledDAError,
  DeviceLockedError,
  OutOfMemoryDAError,
  RefusedByUserDAError,
} from "@api/device-action/os/Errors";
import type { DmkError } from "@api/Error";

export enum SecureChannelErrorType {
  AppAlreadyInstalled,
  DeviceLocked,
  OutOfMemory,
  RefusedByUser,
  Unknown,
}

/**
 * Errors that can possibly occur during a secure channel operation
 */
export type SecureChannelDAErrors =
  | SecureChannelError
  | DeviceLockedError
  | RefusedByUserDAError;

/**
 * Errors that can possibly occur during a secure channel install operation
 * such as installApp or installFirmware
 */
export type SecureChannelInstallDAErrors =
  | SecureChannelError
  | AppAlreadyInstalledDAError
  | OutOfMemoryDAError
  | DeviceLockedError
  | RefusedByUserDAError;

export class WebSocketConnectionError implements DmkError {
  _tag = "WebSocketConnectionError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}

export class SecureChannelError implements DmkError {
  _tag = "SecureChannelError";
  originalError?: unknown;

  constructor(
    public readonly error: unknown,
    public readonly errorType: SecureChannelErrorType = SecureChannelErrorType.Unknown,
  ) {
    this.originalError = error;
  }

  mapDAErrors(): SecureChannelDAErrors {
    switch (this.errorType) {
      case SecureChannelErrorType.DeviceLocked:
        return new DeviceLockedError();
      case SecureChannelErrorType.RefusedByUser:
        return new RefusedByUserDAError();
      default:
        return this;
    }
  }

  mapInstallDAErrors(): SecureChannelInstallDAErrors {
    switch (this.errorType) {
      case SecureChannelErrorType.DeviceLocked:
        return new DeviceLockedError();
      case SecureChannelErrorType.RefusedByUser:
        return new RefusedByUserDAError();
      case SecureChannelErrorType.AppAlreadyInstalled:
        return new AppAlreadyInstalledDAError();
      case SecureChannelErrorType.OutOfMemory:
        return new OutOfMemoryDAError();
      default:
        return this;
    }
  }
}
