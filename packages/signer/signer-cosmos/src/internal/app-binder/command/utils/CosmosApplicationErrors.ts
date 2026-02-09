import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum CosmosErrorCodes {
  EXECUTION_ERROR = "0x6400",
  EMPTY_BUFFER = "0x6982",
  OUTPUT_BUFFER_TOO_SMALL = "0x6983",
  COMMAND_NOT_ALLOWED = "0x6986",
  DATA_INVALID = "0x6984",
  TRANSACTION_DATA_EXCEEDS_BUFFER_CAPACITY = "0x6988",
  WRONG_HRP_LENGTH = "0x698A",
  INVALID_HD_PATH_COIN_VALUE = "0x698B",
  CHAIN_CONFIG_NOT_SUPPORTED = "0x698C",
  EXPERT_MODE_REQUIRED_FOR_ETH_CHAIN = "0x698D",
  INS_NOT_SUPPORTED = "0x6D00",
  CLA_NOT_SUPPORTED = "0x6E00",
  UNKNOWN_ERROR = "0x6F00",
}

export const COSMOS_APP_ERRORS: CommandErrors<CosmosErrorCodes> = {
  "0x6400": { message: "Execution Error" },
  "0x6982": { message: "Empty buffer" },
  "0x6983": { message: "Output buffer too small" },
  "0x6986": { message: "Command not allowed" },
  "0x6984": { message: "Data Invalid" },
  "0x6988": { message: "Transaction data exceeds buffer capacity" },
  "0x698A": { message: "Wrong HRP Length" },
  "0x698B": { message: "Invalid HD path coin value" },
  "0x698C": { message: "Chain Config not supported" },
  "0x698D": { message: "Expert Mode required for Eth chain" },
  "0x6D00": { message: "INS not supported" },
  "0x6E00": { message: "CLA not supported" },
  "0x6F00": { message: "Unknown error" },
};

export class CosmosAppCommandError extends DeviceExchangeError<CosmosErrorCodes> {
  constructor(args: CommandErrorArgs<CosmosErrorCodes>) {
    super({ tag: "CosmosAppCommandError", ...args });
  }
}
