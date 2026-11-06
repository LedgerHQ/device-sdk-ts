import { UnknownDeviceExchangeError } from "@ledgerhq/device-management-kit";

import { BackgroundImageCommandError } from "@api/command/BackgroundImageCommandErrors";
import { InitRestoreAppStorageCommandError } from "@api/command/OsUpdate/Restore/InitRestoreAppStorageCommand";

import { isOutOfMemoryCommandError } from "./outOfMemoryUtils";

describe("isOutOfMemoryCommandError", () => {
  it("should return true for a command error with 5102 error code", () => {
    const error = new BackgroundImageCommandError({
      message: "Not enough memory",
      errorCode: "5102",
    });

    expect(isOutOfMemoryCommandError(error)).toBe(true);
  });

  it("should return true for a command error with 6733 error code", () => {
    const error = new InitRestoreAppStorageCommandError({
      message: "Not enough memory",
      errorCode: "6733",
    });

    expect(isOutOfMemoryCommandError(error)).toBe(true);
  });

  it("should return true for an unknown device exchange error with an out of memory error code", () => {
    const error = new UnknownDeviceExchangeError({
      message: "UnknownError",
      errorCode: "6a84",
    });

    expect(isOutOfMemoryCommandError(error)).toBe(true);
  });

  it("should return false for a command error with another error code", () => {
    const error = new InitRestoreAppStorageCommandError({
      message: "Invalid consent, user rejected.",
      errorCode: "5501",
    });

    expect(isOutOfMemoryCommandError(error)).toBe(false);
  });

  it("should return false for an error without error code", () => {
    expect(isOutOfMemoryCommandError(new Error("boom"))).toBe(false);
    expect(isOutOfMemoryCommandError(null)).toBe(false);
    expect(isOutOfMemoryCommandError(undefined)).toBe(false);
  });
});
