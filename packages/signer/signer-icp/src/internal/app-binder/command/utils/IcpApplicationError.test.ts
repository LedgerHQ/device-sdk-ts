import { IcpAppCommandError, IcpErrorCodes } from "./IcpApplicationErrors";

describe("IcpAppCommandError", () => {
  it('Should have a tag "IcpAppCommandError"', () => {
    const error = new IcpAppCommandError({
      message: "Test error message",
      errorCode: IcpErrorCodes.EXECUTION_ERROR,
    });
    expect(error._tag).toBe("IcpAppCommandError");
  });

  it.each([
    { errorCode: IcpErrorCodes.EXECUTION_ERROR, message: "Execution Error" },
    {
      errorCode: IcpErrorCodes.WRONG_BUFFER_LENGTH,
      message: "Wrong buffer length",
    },
    { errorCode: IcpErrorCodes.EMPTY_BUFFER, message: "Empty buffer" },
    {
      errorCode: IcpErrorCodes.OUTPUT_BUFFER_TOO_SMALL,
      message: "Output buffer too small",
    },
    { errorCode: IcpErrorCodes.DATA_INVALID, message: "Data is invalid" },
    {
      errorCode: IcpErrorCodes.CONDITIONS_NOT_SATISFIED,
      message: "Conditions not satisfied",
    },
    {
      errorCode: IcpErrorCodes.COMMAND_NOT_ALLOWED,
      message: "Command not allowed",
    },
    {
      errorCode: IcpErrorCodes.TX_NOT_INITIALIZED,
      message: "Tx not initialized",
    },
    { errorCode: IcpErrorCodes.BAD_KEY_HANDLE, message: "Bad key handle" },
    { errorCode: IcpErrorCodes.P1_P2_INVALID, message: "P1 or P2 invalid" },
    {
      errorCode: IcpErrorCodes.INS_NOT_SUPPORTED,
      message: "INS not supported",
    },
    {
      errorCode: IcpErrorCodes.CLA_NOT_SUPPORTED,
      message: "CLA not supported",
    },
    { errorCode: IcpErrorCodes.UNKNOWN_ERROR, message: "Unknown error" },
    {
      errorCode: IcpErrorCodes.SIGN_VERIFY_ERROR,
      message: "Sign/verify error",
    },
    { errorCode: IcpErrorCodes.BUSY, message: "Busy" },
  ])(
    "Should have correct error code and message for %s",
    ({ errorCode, message }) => {
      const error = new IcpAppCommandError({
        errorCode: errorCode,
        message: message,
      });
      expect(error.errorCode).toBe(errorCode);
      expect(error.message).toBe(message);
    },
  );
});
