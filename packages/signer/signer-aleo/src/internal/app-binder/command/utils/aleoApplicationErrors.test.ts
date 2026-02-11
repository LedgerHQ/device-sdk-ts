import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandError,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./aleoApplicationErrors";

describe("AleoAppCommandError", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    vi.resetModules();
  });

  it("should be an instance of DeviceExchangeError", () => {
    const error = new AleoAppCommandError({
      message: "Test error message",
      errorCode: "6985",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should set the correct message when provided", () => {
    const customMessage = "Custom error message";
    const error = new AleoAppCommandError({
      message: customMessage,
      errorCode: "6985",
    });

    expect(error.message).toBe(customMessage);
  });

  it("should set the correct customErrorCode", () => {
    const errorCode: AleoErrorCodes = "6a86";
    const error = new AleoAppCommandError({
      message: "Incorrect P1 or P2",
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from aleoApplicationErrors", () => {
    const errorCode: AleoErrorCodes = "6e00";
    const expectedMessage = ALEO_APP_ERRORS[errorCode].message;

    const error = new AleoAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should handle unknown error codes gracefully", () => {
    const unknownErrorCode = "9999" as AleoErrorCodes;
    const customMessage = "Unknown error occurred";

    const error = new AleoAppCommandError({
      message: customMessage,
      errorCode: unknownErrorCode,
    });

    expect(error.errorCode).toBe(unknownErrorCode);
    expect(error.message).toBe(customMessage);
    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  describe("AleoAppCommandErrorFactory", () => {
    it("should create an instance of AleoAppCommandError", () => {
      const error = AleoAppCommandErrorFactory({
        message: "Test error message",
        errorCode: "6985",
      });

      expect(error).toBeInstanceOf(AleoAppCommandError);
      expect(error.message).toBe("Test error message");
      expect(error.errorCode).toBe("6985");
    });
  });
});
