import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  BitcoinAppCommandError,
  type BitcoinAppErrorCodes,
  BTC_APP_ERRORS,
} from "./bitcoinAppErrors";

describe("BitcoinAppCommandError", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
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

  it("should set the correct customErrorCode", () => {
    const errorCode: BitcoinAppErrorCodes = "6A86";
    const error = new BitcoinAppCommandError({
      message: "Either P1 or P2 is incorrect",
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from bitcoinAppErrors", () => {
    const errorCode: BitcoinAppErrorCodes = "6E00";
    const expectedMessage = BTC_APP_ERRORS[errorCode].message;

    const error = new BitcoinAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });
});
