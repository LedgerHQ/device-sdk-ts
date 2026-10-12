import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import {
  HEDERA_APP_ERRORS,
  HederaAppCommandError,
  HederaAppCommandErrorFactory,
} from "./hederaApplicationErrors";

describe("HederaAppCommandError", () => {
  it("should be an instance of DeviceExchangeError", () => {
    const error = new HederaAppCommandError({
      message: "Test error message",
      errorCode: "6985",
    });

    expect(error).toBeInstanceOf(DeviceExchangeError);
    expect(error._tag).toBe("HederaAppCommandError");
  });

  it("should correlate error codes with messages from HEDERA_APP_ERRORS", () => {
    const error = new HederaAppCommandError({
      ...HEDERA_APP_ERRORS["6e00"],
      errorCode: "6e00",
    });

    expect(error.errorCode).toBe("6e00");
    expect(error.message).toBe("Malformed APDU");
  });

  describe("HederaAppCommandErrorFactory", () => {
    it("should create an instance of HederaAppCommandError", () => {
      const error = HederaAppCommandErrorFactory({
        message: "User rejected",
        errorCode: "6985",
      });

      expect(error).toBeInstanceOf(HederaAppCommandError);
      expect(error.errorCode).toBe("6985");
    });
  });
});
