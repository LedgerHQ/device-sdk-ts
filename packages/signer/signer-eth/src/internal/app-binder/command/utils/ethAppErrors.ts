import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type EthErrorCodes =
  | "6001"
  | "6501"
  | "6502"
  | "68xx"
  | "6982"
  | "6983"
  | "6984"
  | "6985"
  | "6A00"
  | "6A80"
  | "6A84"
  | "6A88"
  | "6B00"
  | "6D00"
  | "6E00"
  | "6Fxx"
  | "911C"
  | "6984"
  | "6d00";

export const ETH_APP_ERRORS: CommandErrors<EthErrorCodes> = {
  "6001": { message: "Mode check fail" },
  "6501": { message: "TransactionType not supported" },
  "6502": { message: "Output buffer too small for chainId conversion" },
  "68xx": { message: "Internal error (Please report)" },
  "6982": { message: "Security status not satisfied (Canceled by user)" },
  "6983": { message: "Wrong Data length" },
  "6984": { message: "Plugin not installed" },
  "6985": { message: "Condition not satisfied" },
  "6A00": { message: "Error without info" },
  "6A80": { message: "Invalid data" },
  "6A84": { message: "Insufficient memory" },
  "6A88": { message: "Data not found" },
  "6B00": { message: "Incorrect parameter P1 or P2" },
  "6D00": { message: "Incorrect parameter INS" },
  "6E00": { message: "Incorrect parameter CLA" },
  "6Fxx": { message: "Technical problem (Internal error, please report)" },
  "911C": {
    message: "Command code not supported (i.e., Ledger-PKI not yet available)",
  },
  "6d00": { message: "ETH app is not up to date" },
};

export class EthAppCommandError extends DeviceExchangeError<EthErrorCodes> {
  constructor(args: CommandErrorArgs<EthErrorCodes>) {
    super({ tag: "EthAppCommandError", ...args });
  }
}

export const EthAppCommandErrorFactory = (
  args: CommandErrorArgs<EthErrorCodes>,
) => new EthAppCommandError(args);
