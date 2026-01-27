import {
  DeviceNotOnboardedError,
  type DmkError,
  RefusedByUserDAError,
  UnknownDAError,
} from "@ledgerhq/device-management-kit";

import {
  CLS_ERROR_APDU_TOO_SMALL,
  CLS_ERROR_IMAGE_NOT_CREATED,
  CLS_ERROR_IMAGE_SLOT_NOT_ALLOCATED,
  CLS_ERROR_INVALID_CHUNK_OFFSET,
  CLS_ERROR_INVALID_CHUNK_SIZE,
  CLS_ERROR_INVALID_METADATA,
  CLS_ERROR_INVALID_SIZE,
  CLS_ERROR_NO_BACKGROUND_IMAGE,
  CLS_ERROR_PIN_NOT_SET,
  CLS_ERROR_RECOVERY_MODE,
  CLS_ERROR_REGISTRY_ERROR,
  CLS_ERROR_USER_REFUSED,
} from "@api/command/BackgroundImageCommandErrors";

// ============================================================================
// CLS-specific DA Error Classes
// ============================================================================

/**
 * Error when trying to download/remove a custom lock screen but no image exists on the device.
 * Corresponds to error code `662e`.
 */
export class NoCustomLockScreenImageDAError implements DmkError {
  readonly _tag = "NoCustomLockScreenImageDAError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

/**
 * Error when the device is in recovery mode and cannot perform CLS operations.
 * Corresponds to error code `662f`.
 */
export class DeviceInRecoveryModeDAError implements DmkError {
  readonly _tag = "DeviceInRecoveryModeDAError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

/**
 * Error when the image data is invalid or incompatible with the device.
 * Corresponds to error codes: `681f` (invalid metadata), `6820` (invalid size),
 * `6832` (invalid chunk size), `6703` (APDU size too small), `680b` (invalid offset/length).
 */
export class InvalidCustomLockScreenImageDataDAError implements DmkError {
  readonly _tag = "InvalidCustomLockScreenImageDataDAError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

/**
 * Error when CLS commands are called in wrong order or state.
 * Corresponds to error codes: `5106` (create not called), `551e` (image not created).
 */
export class InvalidCustomLockScreenStateDAError implements DmkError {
  readonly _tag = "InvalidCustomLockScreenStateDAError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

/**
 * Error for internal device/registry errors during CLS operations.
 * Corresponds to error code: `6621` (internal registry error).
 */
export class CustomLockScreenDeviceInternalErrorDAError implements DmkError {
  readonly _tag = "CustomLockScreenDeviceInternalErrorDAError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}

// ============================================================================
// Helper to extract error code
// ============================================================================

function getErrorCode(error: unknown): string | null {
  return error !== null &&
    typeof error === "object" &&
    "errorCode" in error &&
    typeof (error as { errorCode: unknown }).errorCode === "string"
    ? (error as { errorCode: string }).errorCode
    : null;
}

// ============================================================================
// DA-Specific Error Types and Mapping Functions
// ============================================================================

/**
 * Errors possible from Remove DA (uses Delete command).
 * Delete errors: 5501, 5502, 6621, 662e, 662f
 */
export type RemoveCommandDAError =
  | RefusedByUserDAError
  | DeviceNotOnboardedError
  | CustomLockScreenDeviceInternalErrorDAError
  | NoCustomLockScreenImageDAError
  | DeviceInRecoveryModeDAError
  | UnknownDAError;

/**
 * Maps a Delete command error to a RemoveCommandDAError.
 */
export function mapRemoveCommandError(error: unknown): RemoveCommandDAError {
  const errorCode = getErrorCode(error);

  if (!errorCode) {
    return new UnknownDAError(
      error instanceof Error ? error.message : "Unknown CLS error",
    );
  }

  switch (errorCode) {
    case CLS_ERROR_USER_REFUSED:
      return new RefusedByUserDAError("User refused on device");
    case CLS_ERROR_PIN_NOT_SET:
      return new DeviceNotOnboardedError("Device PIN not set");
    case CLS_ERROR_REGISTRY_ERROR:
      return new CustomLockScreenDeviceInternalErrorDAError(error);
    case CLS_ERROR_NO_BACKGROUND_IMAGE:
      return new NoCustomLockScreenImageDAError(error);
    case CLS_ERROR_RECOVERY_MODE:
      return new DeviceInRecoveryModeDAError(error);
    default:
      return new UnknownDAError(`CLS command error: ${errorCode}`);
  }
}

/**
 * Errors possible from Upload DA (uses Create, Load, Commit commands).
 * Create errors: 662f, 5501, 5502
 * Load errors: 5106, 551e, 662f, 6703, 680b
 * Commit errors: 5501, 5502, 551e, 662f, 681f, 6820
 */
export type UploadCommandsDAError =
  | RefusedByUserDAError
  | DeviceNotOnboardedError
  | DeviceInRecoveryModeDAError
  | InvalidCustomLockScreenStateDAError
  | InvalidCustomLockScreenImageDataDAError
  | UnknownDAError;

/**
 * Maps Create/Load/Commit command errors to UploadCommandsDAError.
 */
export function mapUploadCommandError(error: unknown): UploadCommandsDAError {
  const errorCode = getErrorCode(error);

  if (!errorCode) {
    return new UnknownDAError(
      error instanceof Error ? error.message : "Unknown CLS error",
    );
  }

  switch (errorCode) {
    // User refused (Create, Commit)
    case CLS_ERROR_USER_REFUSED:
      return new RefusedByUserDAError("User refused on device");
    // PIN not set (Create, Commit)
    case CLS_ERROR_PIN_NOT_SET:
      return new DeviceNotOnboardedError("Device PIN not set");
    // Recovery mode (Create, Load, Commit)
    case CLS_ERROR_RECOVERY_MODE:
      return new DeviceInRecoveryModeDAError(error);
    // Invalid state (Load, Commit)
    case CLS_ERROR_IMAGE_NOT_CREATED:
    case CLS_ERROR_IMAGE_SLOT_NOT_ALLOCATED:
      return new InvalidCustomLockScreenStateDAError(error);
    // Invalid data (Load, Commit)
    case CLS_ERROR_APDU_TOO_SMALL:
    case CLS_ERROR_INVALID_CHUNK_OFFSET:
    case CLS_ERROR_INVALID_METADATA:
    case CLS_ERROR_INVALID_SIZE:
      return new InvalidCustomLockScreenImageDataDAError(error);
    default:
      return new UnknownDAError(`CLS command error: ${errorCode}`);
  }
}

/**
 * Errors possible from Download DA (uses GetHash, GetSize, Fetch commands).
 * GetHash errors: 662e, 662f
 * GetSize errors: 662f
 * Fetch errors: 662e, 662f, 6832
 */
export type DownloadCommandsDAError =
  | NoCustomLockScreenImageDAError
  | DeviceInRecoveryModeDAError
  | InvalidCustomLockScreenImageDataDAError
  | UnknownDAError;

/**
 * Maps GetHash/GetSize/Fetch command errors to DownloadCommandsDAError.
 */
export function mapDownloadCommandError(
  error: unknown,
): DownloadCommandsDAError {
  const errorCode = getErrorCode(error);

  if (!errorCode) {
    return new UnknownDAError(
      error instanceof Error ? error.message : "Unknown CLS error",
    );
  }

  switch (errorCode) {
    case CLS_ERROR_NO_BACKGROUND_IMAGE:
      return new NoCustomLockScreenImageDAError(error);
    case CLS_ERROR_RECOVERY_MODE:
      return new DeviceInRecoveryModeDAError(error);
    case CLS_ERROR_INVALID_CHUNK_SIZE:
      return new InvalidCustomLockScreenImageDataDAError(error);
    default:
      return new UnknownDAError(`CLS command error: ${errorCode}`);
  }
}
