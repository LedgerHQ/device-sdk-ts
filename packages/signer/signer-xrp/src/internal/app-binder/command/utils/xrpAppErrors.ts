import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * XRP Ledger App Error Codes
 *
 * These are the status codes returned by the XRP Ledger app.
 * Error codes are strings of hex status words.
 */
export type XrpErrorCodes =
  | "6700"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const XRP_APP_ERRORS: CommandErrors<XrpErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6985": { message: "User refused the operation" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class XrpAppCommandError extends DeviceExchangeError<XrpErrorCodes> {
  constructor(args: CommandErrorArgs<XrpErrorCodes>) {
    super({ tag: "XrpAppCommandError", ...args });
  }
}

export const XrpAppCommandErrorFactory = (
  args: CommandErrorArgs<XrpErrorCodes>,
) => new XrpAppCommandError(args);
