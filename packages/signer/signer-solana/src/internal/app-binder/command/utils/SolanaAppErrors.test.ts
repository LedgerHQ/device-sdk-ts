import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandError,
  type SolanaAppErrorCodes,
} from "./SolanaApplicationErrors";

describe("SolanaAppCommandError", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it("should be an instance of DeviceExchangeError", () => {
    const error = new SolanaAppCommandError({
      message: "Test error message",
      errorCode: "6700",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should set the correct message when provided", () => {
    const customMessage = "Custom error message";
    const error = new SolanaAppCommandError({
      message: customMessage,
      errorCode: "6700",
    });

    expect(error.message).toBe(customMessage);
  });

  it("should set the correct customErrorCode", () => {
    const errorCode: SolanaAppErrorCodes = "6a80";
    const error = new SolanaAppCommandError({
      message: "Invalid data",
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from solanaAppErrors", () => {
    const errorCode: SolanaAppErrorCodes = "6b00";
    const expectedMessage = SOLANA_APP_ERRORS[errorCode].message;

    const error = new SolanaAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });
});
