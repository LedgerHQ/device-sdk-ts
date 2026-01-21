import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * Custom Lock Screen command error codes.
 * These are APDU status codes returned by CLS-related commands.
 */

// User interaction
export const CLS_ERROR_USER_REFUSED = "5501" as const;

// Device state
export const CLS_ERROR_PIN_NOT_SET = "5502" as const;
export const CLS_ERROR_DEVICE_LOCKED = "5515" as const;
export const CLS_ERROR_RECOVERY_MODE = "662f" as const;

// Image state
export const CLS_ERROR_NO_BACKGROUND_IMAGE = "662e" as const;
export const CLS_ERROR_IMAGE_NOT_CREATED = "5106" as const;
export const CLS_ERROR_IMAGE_SLOT_NOT_ALLOCATED = "551e" as const;

// Invalid data errors
export const CLS_ERROR_INVALID_METADATA = "681f" as const;
export const CLS_ERROR_INVALID_SIZE = "6820" as const;
export const CLS_ERROR_INVALID_CHUNK_SIZE = "6832" as const;
export const CLS_ERROR_APDU_TOO_SMALL = "6703" as const;
export const CLS_ERROR_INVALID_CHUNK_OFFSET = "680b" as const;

// Internal errors
export const CLS_ERROR_REGISTRY_ERROR = "6621" as const;
export const CLS_ERROR_DEVICE_INTERNAL = "5223" as const;
export const CLS_ERROR_CLA_NOT_SUPPORTED = "6e00" as const;
export const CLS_ERROR_INS_NOT_SUPPORTED = "6d00" as const;

// ============================================================================
// Per-command error definitions (based on firmware spec)
// ============================================================================

/**
 * Create Background Image (0x60) errors: 662f, 5501, 5502
 */
export const CREATE_BACKGROUND_IMAGE_ERRORS = {
  [CLS_ERROR_RECOVERY_MODE]: { message: "Device is in recovery mode" },
  [CLS_ERROR_USER_REFUSED]: { message: "User refused on device" },
  [CLS_ERROR_PIN_NOT_SET]: { message: "PIN not validated" },
} as const satisfies CommandErrors<string>;
export type CreateBackgroundImageErrorCodes =
  keyof typeof CREATE_BACKGROUND_IMAGE_ERRORS;

/**
 * Load/Upload Background Image Chunk (0x61) errors: 5106, 551e, 662f, 6703, 680b
 */
export const UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS = {
  [CLS_ERROR_IMAGE_NOT_CREATED]: {
    message: "Invalid state, create background image has not been called",
  },
  [CLS_ERROR_IMAGE_SLOT_NOT_ALLOCATED]: { message: "Image not created" },
  [CLS_ERROR_RECOVERY_MODE]: { message: "Device is in recovery mode" },
  [CLS_ERROR_APDU_TOO_SMALL]: { message: "APDU size is too small" },
  [CLS_ERROR_INVALID_CHUNK_OFFSET]: {
    message: "Invalid chunk offset or length",
  },
} as const satisfies CommandErrors<string>;
export type UploadBackgroundImageChunkErrorCodes =
  keyof typeof UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS;

/**
 * Commit Background Image (0x62) errors: 5501, 5502, 551e, 662f, 681f, 6820
 */
export const COMMIT_BACKGROUND_IMAGE_ERRORS = {
  [CLS_ERROR_USER_REFUSED]: { message: "User refused on device" },
  [CLS_ERROR_PIN_NOT_SET]: { message: "PIN not validated" },
  [CLS_ERROR_IMAGE_SLOT_NOT_ALLOCATED]: { message: "Image not created" },
  [CLS_ERROR_RECOVERY_MODE]: { message: "Device is in recovery mode" },
  [CLS_ERROR_INVALID_METADATA]: { message: "Image metadata are not valid" },
  [CLS_ERROR_INVALID_SIZE]: { message: "Invalid image size" },
} as const satisfies CommandErrors<string>;
export type CommitBackgroundImageErrorCodes =
  keyof typeof COMMIT_BACKGROUND_IMAGE_ERRORS;

/**
 * Delete Background Image (0x63) errors: 5501, 5502, 6621, 662e, 662f
 */
export const DELETE_BACKGROUND_IMAGE_ERRORS = {
  [CLS_ERROR_USER_REFUSED]: { message: "User refused on device" },
  [CLS_ERROR_PIN_NOT_SET]: { message: "PIN not validated" },
  [CLS_ERROR_REGISTRY_ERROR]: { message: "Internal registry error" },
  [CLS_ERROR_NO_BACKGROUND_IMAGE]: {
    message: "No background image loaded on device",
  },
  [CLS_ERROR_RECOVERY_MODE]: { message: "Device is in recovery mode" },
} as const satisfies CommandErrors<string>;
export type DeleteBackgroundImageErrorCodes =
  keyof typeof DELETE_BACKGROUND_IMAGE_ERRORS;

/**
 * Get Background Image Hash (0x66) errors: 662e, 662f
 */
export const GET_BACKGROUND_IMAGE_HASH_ERRORS = {
  [CLS_ERROR_NO_BACKGROUND_IMAGE]: {
    message: "No background image loaded on device",
  },
  [CLS_ERROR_RECOVERY_MODE]: { message: "Device is in recovery mode" },
} as const satisfies CommandErrors<string>;
export type GetBackgroundImageHashErrorCodes =
  keyof typeof GET_BACKGROUND_IMAGE_HASH_ERRORS;

/**
 * Fetch Background Image Chunk (0x65) errors: 662e, 662f, 6832
 */
export const FETCH_BACKGROUND_IMAGE_CHUNK_ERRORS = {
  [CLS_ERROR_NO_BACKGROUND_IMAGE]: {
    message: "No background image loaded on device",
  },
  [CLS_ERROR_RECOVERY_MODE]: { message: "Device is in recovery mode" },
  [CLS_ERROR_INVALID_CHUNK_SIZE]: {
    message: "Invalid image chunk size requested",
  },
} as const satisfies CommandErrors<string>;
export type FetchBackgroundImageChunkErrorCodes =
  keyof typeof FETCH_BACKGROUND_IMAGE_CHUNK_ERRORS;

// ============================================================================
// Generic error class (used by all commands)
// ============================================================================

/** Union of all possible background image error codes */
export type BackgroundImageErrorCodes =
  | CreateBackgroundImageErrorCodes
  | UploadBackgroundImageChunkErrorCodes
  | CommitBackgroundImageErrorCodes
  | DeleteBackgroundImageErrorCodes
  | GetBackgroundImageHashErrorCodes
  | FetchBackgroundImageChunkErrorCodes;

/**
 * Generic error class for background image commands.
 * Parameterized by the specific error code type for type safety.
 */
export class BackgroundImageCommandError<
  T extends string = BackgroundImageErrorCodes,
> extends DeviceExchangeError<T> {
  constructor(args: CommandErrorArgs<T>) {
    super({ tag: "BackgroundImageCommandError", ...args });
  }
}

// ============================================================================
// Per-command error factories (for use with CommandErrorHelper)
// ============================================================================

export const createBackgroundImageErrorFactory = (
  args: CommandErrorArgs<CreateBackgroundImageErrorCodes>,
) => new BackgroundImageCommandError<CreateBackgroundImageErrorCodes>(args);

export const uploadBackgroundImageChunkErrorFactory = (
  args: CommandErrorArgs<UploadBackgroundImageChunkErrorCodes>,
) =>
  new BackgroundImageCommandError<UploadBackgroundImageChunkErrorCodes>(args);

export const commitBackgroundImageErrorFactory = (
  args: CommandErrorArgs<CommitBackgroundImageErrorCodes>,
) => new BackgroundImageCommandError<CommitBackgroundImageErrorCodes>(args);

export const deleteBackgroundImageErrorFactory = (
  args: CommandErrorArgs<DeleteBackgroundImageErrorCodes>,
) => new BackgroundImageCommandError<DeleteBackgroundImageErrorCodes>(args);

export const getBackgroundImageHashErrorFactory = (
  args: CommandErrorArgs<GetBackgroundImageHashErrorCodes>,
) => new BackgroundImageCommandError<GetBackgroundImageHashErrorCodes>(args);

export const fetchBackgroundImageChunkErrorFactory = (
  args: CommandErrorArgs<FetchBackgroundImageChunkErrorCodes>,
) => new BackgroundImageCommandError<FetchBackgroundImageChunkErrorCodes>(args);
