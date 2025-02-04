import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  BTC_APP_ERRORS,
  BtcAppCommandError,
  type BtcErrorCodes,
} from "./bitcoinAppErrors";

describe("BtcAppCommandError", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    vi.resetModules();
  });

  it("should be an instance of DeviceExchangeError", () => {
    const error = new BtcAppCommandError({
      message: "Test error message",
      errorCode: "6985",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it("should set the correct message when provided", () => {
    const customMessage = "Custom error message";
    const error = new BtcAppCommandError({
      message: customMessage,
      errorCode: "6985",
    });

    expect(error.message).toBe(customMessage);
  });

  it("should set the correct customErrorCode", () => {
    const errorCode: BtcErrorCodes = "6a86";
    const error = new BtcAppCommandError({
      message: "Either P1 or P2 is incorrect",
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
  });

  it("should correlate error codes with messages from bitcoinAppErrors", () => {
    const errorCode: BtcErrorCodes = "6e00";
    const expectedMessage = BTC_APP_ERRORS[errorCode].message;

    const error = new BtcAppCommandError({
      message: expectedMessage,
      errorCode,
    });

    expect(error.errorCode).toBe(errorCode);
    expect(error.message).toBe(expectedMessage);

    expect(error).toBeInstanceOf(DeviceExchangeError);
  });
});
