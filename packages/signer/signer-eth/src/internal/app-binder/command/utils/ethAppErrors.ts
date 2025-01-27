import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type EthErrorCodes =
  | "6001"
  | "6501"
  | "6502"
  | "6800"
  | "6982"
  | "6983"
  | "6984"
  | "6985"
  | "6a00"
  | "6a80"
  | "6a84"
  | "6a88"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00"
  | "911c"
  | "6984";

export const ETH_APP_ERRORS: CommandErrors<EthErrorCodes> = {
  "6001": { message: "Mode check fail" },
  "6501": { message: "TransactionType not supported" },
  "6502": { message: "Output buffer too small for chainId conversion" },
  "6800": { message: "Internal error (Please report)" },
  "6982": { message: "Security status not satisfied (Canceled by user)" },
  "6983": { message: "Wrong Data length" },
  "6984": { message: "Plugin not installed" },
  "6985": { message: "Condition not satisfied" },
  "6a00": { message: "Error without info" },
  "6a80": { message: "Invalid data" },
  "6a84": { message: "Insufficient memory" },
  "6a88": { message: "Data not found" },
  "6b00": { message: "Incorrect parameter P1 or P2" },
  "6d00": { message: "Incorrect parameter INS" },
  "6e00": { message: "Incorrect parameter CLA" },
  "6f00": { message: "Technical problem (Internal error, please report)" },
  "911c": {
    message: "Command code not supported (i.e., Ledger-PKI not yet available)",
  },
};

export class EthAppCommandError extends DeviceExchangeError<EthErrorCodes> {
  constructor(args: CommandErrorArgs<EthErrorCodes>) {
    super({ tag: "EthAppCommandError", ...args });
  }
}

export const EthAppCommandErrorFactory = (
  args: CommandErrorArgs<EthErrorCodes>,
) => new EthAppCommandError(args);
