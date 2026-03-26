import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type ZcashErrorCodes = "6400" | "6700" | "6985" | "6b00" | "6d00";

export const ZCASH_APP_ERRORS: CommandErrors<ZcashErrorCodes> = {
  "6400": { message: "Execution error" },
  "6700": { message: "Wrong APDU length" },
  "6985": { message: "Rejected by the user" },
  "6b00": { message: "Either P1 or P2 is incorrect" },
  "6d00": { message: "Incorrect INS" },
};

export class ZcashAppCommandError extends DeviceExchangeError<ZcashErrorCodes> {
  constructor(args: CommandErrorArgs<ZcashErrorCodes>) {
    super({ tag: "ZcashAppCommandError", ...args });
  }
}

export const ZcashAppCommandErrorFactory = (
  args: CommandErrorArgs<ZcashErrorCodes>,
) => new ZcashAppCommandError(args);
