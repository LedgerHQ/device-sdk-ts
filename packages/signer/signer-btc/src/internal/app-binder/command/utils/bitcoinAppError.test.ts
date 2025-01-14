import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  BitcoinAppCommandError,
  type BitcoinAppErrorCodes,
  bitcoinAppErrors,
} from "./bitcoinAppErrors";

describe("BitcoinAppCommandError", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    vi.resetModules();
  });

  it("should be an instance of DeviceExchangeError", () => {
    const error = new BitcoinAppCommandError({
      message: "Test error message",
      errorCode: "6985",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should set the correct message when provided", () => {
    const customMessage = "Custom error message";
    const error = new BitcoinAppCommandError({
      message: customMessage,
      errorCode: "6985",
    });

    expect(error.message).toBe(customMessage);
  });

  it("should set the default message when none is provided", () => {
    const error = new BitcoinAppCommandError({
      message: undefined,
      errorCode: "6985",
    });

    expect(error.message).toBe("An error occurred during device exchange.");
  });

  it("should set the correct customErrorCode", () => {
    const errorCode: BitcoinAppErrorCodes = "6A86";
    const error = new BitcoinAppCommandError({
      message: "Either P1 or P2 is incorrect",
      errorCode,
    });

    expect(error.customErrorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from bitcoinAppErrors", () => {
    const errorCode: BitcoinAppErrorCodes = "6E00";
    const expectedMessage = bitcoinAppErrors[errorCode].message;

    const error = new BitcoinAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.customErrorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });
});
