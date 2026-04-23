import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type ZcashErrorCodes =
  | "6400"
  | "6700"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const ZCASH_APP_ERRORS: CommandErrors<ZcashErrorCodes> = {
  "6400": { message: "Execution error" },
  "6700": { message: "Wrong APDU length" },
  "6985": { message: "Denied by user" },
  "6a80": { message: "Incorrect data" },
  "6b00": { message: "Wrong P1/P2" },
  "6d00": { message: "INS not supported" },
  "6e00": { message: "CLA not supported" },
  "6f00": { message: "Technical problem" },
};

export class ZcashAppCommandError extends DeviceExchangeError<ZcashErrorCodes> {
  constructor(args: CommandErrorArgs<ZcashErrorCodes>) {
    super({ tag: "ZcashAppCommandError", ...args });
  }
}

export const ZcashAppCommandErrorFactory = (
  args: CommandErrorArgs<ZcashErrorCodes>,
) => new ZcashAppCommandError(args);
