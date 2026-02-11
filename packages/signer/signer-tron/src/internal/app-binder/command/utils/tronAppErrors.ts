import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * Tron Ledger App Error Codes
 *
 * These are the status codes returned by the Tron Ledger app.
 * Error codes are strings of hex status words.
 */
export type TronErrorCodes =
  | "6700"
  | "6982"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const TRON_APP_ERRORS: CommandErrors<TronErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "User refused the operation" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class TronAppCommandError extends DeviceExchangeError<TronErrorCodes> {
  constructor(args: CommandErrorArgs<TronErrorCodes>) {
    super({ tag: "TronAppCommandError", ...args });
  }
}

export const TronAppCommandErrorFactory = (
  args: CommandErrorArgs<TronErrorCodes>,
) => new TronAppCommandError(args);
