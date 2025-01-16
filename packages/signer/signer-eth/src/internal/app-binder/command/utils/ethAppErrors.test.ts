import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  ETH_APP_ERRORS,
  EthAppCommandError,
  type EthErrorCodes,
} from "./ethAppErrors";

describe("EthAppCommandError", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it("should be an instance of DeviceExchangeError", () => {
    const error = new EthAppCommandError({
      message: "Test error message",
      errorCode: "6985",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should set the correct message when provided", () => {
    const customMessage = "Custom error message";
    const error = new EthAppCommandError({
      message: customMessage,
      errorCode: "6985",
    });

    expect(error.message).toBe(customMessage);
  });

  it("should set the correct customErrorCode", () => {
    const errorCode: EthErrorCodes = "6A80";
    const error = new EthAppCommandError({
      message: "Invalid data",
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from ethereumAppErrors", () => {
    const errorCode: EthErrorCodes = "6E00";
    const expectedMessage = ETH_APP_ERRORS[errorCode].message;

    const error = new EthAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should handle unknown error codes gracefully", () => {
    const unknownErrorCode = "9999" as EthErrorCodes;
    const customMessage = "Unknown error occurred";

    const error = new EthAppCommandError({
      message: customMessage,
      errorCode: unknownErrorCode,
    });

    expect(error.errorCode).toBe(unknownErrorCode);
    expect(error.message).toBe(customMessage);
    expect(error).toBeInstanceOf(DeviceExchangeError);
  });
});
