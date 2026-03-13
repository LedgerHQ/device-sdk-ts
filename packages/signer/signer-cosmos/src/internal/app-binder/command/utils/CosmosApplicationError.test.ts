import {
  CosmosAppCommandError,
  CosmosErrorCodes,
} from "./CosmosApplicationErrors";

describe("CosmosAppCommandError", () => {
  it('Should have a tag "CosmosAppCommandError"', () => {
    const error = new CosmosAppCommandError({
      message: "Test error message",
      errorCode: CosmosErrorCodes.EXECUTION_ERROR,
    });
    expect(error._tag).toBe("CosmosAppCommandError");
  });

  it.each([
    { errorCode: CosmosErrorCodes.EXECUTION_ERROR, message: "Execution Error" },
    { errorCode: CosmosErrorCodes.EMPTY_BUFFER, message: "Empty buffer" },
    {
      errorCode: CosmosErrorCodes.OUTPUT_BUFFER_TOO_SMALL,
      message: "Output buffer too small",
    },
    {
      errorCode: CosmosErrorCodes.COMMAND_NOT_ALLOWED,
      message: "Command not allowed",
    },
    { errorCode: CosmosErrorCodes.DATA_INVALID, message: "Data Invalid" },
    {
      errorCode: CosmosErrorCodes.TRANSACTION_DATA_EXCEEDS_BUFFER_CAPACITY,
      message: "Transaction data exceeds buffer capacity",
    },
    {
      errorCode: CosmosErrorCodes.WRONG_HRP_LENGTH,
      message: "Wrong HRP Length",
    },
    {
      errorCode: CosmosErrorCodes.INVALID_HD_PATH_COIN_VALUE,
      message: "Invalid HD path coin value",
    },
    {
      errorCode: CosmosErrorCodes.CHAIN_CONFIG_NOT_SUPPORTED,
      message: "Chain Config not supported",
    },
    {
      errorCode: CosmosErrorCodes.EXPERT_MODE_REQUIRED_FOR_ETH_CHAIN,
      message: "Expert Mode required for Eth chain",
    },
    {
      errorCode: CosmosErrorCodes.INS_NOT_SUPPORTED,
      message: "INS not supported",
    },
    {
      errorCode: CosmosErrorCodes.CLA_NOT_SUPPORTED,
      message: "CLA not supported",
    },
    { errorCode: CosmosErrorCodes.UNKNOWN_ERROR, message: "Unknown error" },
  ])(
    "Should have correct error code and message for %s",
    ({ errorCode, message }) => {
      const error = new CosmosAppCommandError({
        errorCode: errorCode,
        message: message,
      });
      expect(error.errorCode).toBe(errorCode);
      expect(error.message).toBe(message);
    },
  );
});
