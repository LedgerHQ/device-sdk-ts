import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { SolanaAppCommandError } from "./solanaAppErrors";

describe("SolanaAppCommandError", () => {
  it("should correctly instantiate with a message and error code", () => {
    const message = "Invalid data";
    const errorCode = "6A80";

    const error = new SolanaAppCommandError({
      message,
      errorCode,
    });

    expect(error).toBeInstanceOf(SolanaAppCommandError);
    expect(error.message).toBe(message);
    expect(error.customErrorCode).toBe(errorCode);
    expect(error._tag).toBe("SolanaAppCommandError");
  });

  it("should correctly instantiate without an error code", () => {
    const message = "Some generic error";

    const error = new SolanaAppCommandError({
      message,
      errorCode: undefined,
    });

    expect(error).toBeInstanceOf(SolanaAppCommandError);
    expect(error.message).toBe(message);
    expect(error.customErrorCode).toBeUndefined();
    expect(error._tag).toBe("SolanaAppCommandError");
  });

  it("should handle default message if none is provided", () => {
    const error = new SolanaAppCommandError({
      message: "An error occurred during device exchange.",
      errorCode: "6A80",
    });

    expect(error).toBeInstanceOf(SolanaAppCommandError);
    expect(error.message).toBe("An error occurred during device exchange.");
    expect(error.customErrorCode).toBe("6A80");
    expect(error._tag).toBe("SolanaAppCommandError");
  });

  it("should extend DeviceExchangeError", () => {
    const message = "Security status not satisfied";
    const errorCode = "6982";

    const error = new SolanaAppCommandError({
      message,
      errorCode,
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
    expect(error).toBeInstanceOf(SolanaAppCommandError);
    expect(error._tag).toBe("SolanaAppCommandError");
    expect(error.message).toBe(message);
    expect(error.customErrorCode).toBe(errorCode);
  });

  it("should allow custom properties to be checked", () => {
    const message = "Invalid parameter";
    const errorCode = "6B00";

    const error = new SolanaAppCommandError({
      message,
      errorCode,
    });

    expect(error.customErrorCode).toBe("6B00");
    expect(error.customErrorCode).not.toBe("6A80");
  });
});
