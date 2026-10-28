import { DeviceExchangeError } from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import {
  POLKADOT_APP_ERRORS,
  PolkadotAppCommandError,
  PolkadotAppCommandErrorFactory,
  PolkadotErrorCodes,
} from "./polkadotApplicationErrors";

describe("PolkadotAppCommandError", () => {
  it('should have tag "PolkadotAppCommandError"', () => {
    // ARRANGE
    const error = new PolkadotAppCommandError({
      message: "Test error",
      errorCode: PolkadotErrorCodes.EXECUTION_ERROR,
    });
    // ASSERT
    expect(error._tag).toBe("PolkadotAppCommandError");
  });

  it("should be an instance of DeviceExchangeError", () => {
    // ARRANGE
    const error = new PolkadotAppCommandError({
      message: "Test error",
      errorCode: PolkadotErrorCodes.EXECUTION_ERROR,
    });
    // ASSERT
    expect(error).toBeInstanceOf(DeviceExchangeError);
  });

  it.each([
    {
      errorCode: PolkadotErrorCodes.EXECUTION_ERROR,
      message: "Execution Error",
    },
    {
      errorCode: PolkadotErrorCodes.WRONG_BUFFER_LENGTH,
      message: "Wrong buffer length",
    },
    { errorCode: PolkadotErrorCodes.EMPTY_BUFFER, message: "Empty buffer" },
    {
      errorCode: PolkadotErrorCodes.OUTPUT_BUFFER_TOO_SMALL,
      message: "Output buffer too small",
    },
    { errorCode: PolkadotErrorCodes.DATA_INVALID, message: "Data is invalid" },
    {
      errorCode: PolkadotErrorCodes.COMMAND_NOT_ALLOWED,
      message: "Command not allowed",
    },
    {
      errorCode: PolkadotErrorCodes.TX_NOT_INITIALIZED,
      message: "Tx is not initialized",
    },
    {
      errorCode: PolkadotErrorCodes.P1_P2_INVALID,
      message: "P1/P2 are invalid",
    },
    {
      errorCode: PolkadotErrorCodes.INS_NOT_SUPPORTED,
      message: "INS not supported",
    },
    {
      errorCode: PolkadotErrorCodes.CLA_NOT_SUPPORTED,
      message: "CLA not supported",
    },
    { errorCode: PolkadotErrorCodes.UNKNOWN_ERROR, message: "Unknown error" },
    {
      errorCode: PolkadotErrorCodes.SIGN_VERIFY_ERROR,
      message: "Sign / verify error",
    },
  ])(
    "should have correct errorCode and message for $errorCode",
    ({ errorCode, message }) => {
      // ARRANGE
      const error = new PolkadotAppCommandError({ errorCode, message });
      // ASSERT
      expect(error.errorCode).toBe(errorCode);
      expect(error.message).toBe(message);
    },
  );
});

describe("PolkadotAppCommandErrorFactory", () => {
  it("should produce PolkadotAppCommandError instances", () => {
    // ARRANGE
    const error = PolkadotAppCommandErrorFactory({
      message: "Data is invalid",
      errorCode: PolkadotErrorCodes.DATA_INVALID,
    });
    // ASSERT
    expect(error).toBeInstanceOf(PolkadotAppCommandError);
    expect(error).toBeInstanceOf(DeviceExchangeError);
    expect(error.errorCode).toBe(PolkadotErrorCodes.DATA_INVALID);
  });
});

describe("POLKADOT_APP_ERRORS", () => {
  it("should have entries for all 12 Polkadot error codes", () => {
    // ARRANGE
    const expectedCodes = Object.values(PolkadotErrorCodes);
    // ASSERT
    expect(expectedCodes).toHaveLength(12);
    for (const code of expectedCodes) {
      expect(POLKADOT_APP_ERRORS).toHaveProperty(code);
      expect(typeof POLKADOT_APP_ERRORS[code].message).toBe("string");
    }
  });
});
