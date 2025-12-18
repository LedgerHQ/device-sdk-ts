import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type CosmosAppErrorCodes =
  | "6400"
  | "6982"
  | "6983"
  | "6986"
  | "6984"
  | "6988"
  | "698A"
  | "698B"
  | "698C"
  | "698D"
  | "6D00"
  | "6E00"
  | "6F00";

export const COSMOS_APP_ERRORS: CommandErrors<CosmosAppErrorCodes> = {
  "6400": { message: "Execution Error" },
  "6982": { message: "Empty buffer" },
  "6983": { message: "Output buffer too small" },
  "6986": { message: "Command not allowed" },
  "6984": { message: "Data Invalid (More info on error message)" },
  "6988": { message: "Transaction data exceeds buffer capacity" },
  "698A": { message: "Wrong HRP Length" },
  "698B": { message: "Invalid HD path coin value" },
  "698C": { message: "Chain Config not supported" },
  "698D": { message: "Expert Mode required for Eth chain" },
  "6D00": { message: "INS not supported" },
  "6E00": { message: "CLA not supported" },
  "6F00": { message: "Unknown Error" },
};

export class CosmosAppCommandError extends DeviceExchangeError<CosmosAppErrorCodes> {
  constructor(args: CommandErrorArgs<CosmosAppErrorCodes>) {
    super({ tag: "CosmosAppCommandError", ...args });
  }
}

export const CosmosAppCommandErrorFactory = (
  args: CommandErrorArgs<CosmosAppErrorCodes>,
) => new CosmosAppCommandError(args);
