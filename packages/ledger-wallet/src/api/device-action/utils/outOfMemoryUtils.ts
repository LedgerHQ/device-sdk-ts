import {
  ApduResponse,
  CommandUtils,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

const getErrorCode = (error: unknown): string | null => {
  if (error === null || typeof error !== "object") {
    return null;
  }
  if ("errorCode" in error && typeof error.errorCode === "string") {
    return error.errorCode;
  }
  // UnknownDeviceExchangeError (from GlobalCommandErrorHandler) carries the
  // error code in its originalError
  if ("originalError" in error) {
    return getErrorCode(error.originalError);
  }
  return null;
};

/**
 * Whether a command error was caused by an out of memory status word,
 * as defined by CommandUtils.isOutOfMemory.
 */
export const isOutOfMemoryCommandError = (error: unknown): boolean => {
  const errorCode = getErrorCode(error);
  const statusCode = errorCode === null ? null : hexaStringToBuffer(errorCode);
  if (statusCode === null) {
    return false;
  }
  return CommandUtils.isOutOfMemory(
    new ApduResponse({ statusCode, data: new Uint8Array() }),
  );
};
