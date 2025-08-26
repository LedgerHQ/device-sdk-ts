import { CommandErrorArgs, CommandErrors, DeviceExchangeError } from "@ledgerhq/device-management-kit";

export type CantonAppErrorCodes = 
  | "6985"
  | "6a00"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"


  export const CANTON_APP_ERRORS: CommandErrors<CantonAppErrorCodes> = {
    "6985": { message: "Condition not satisfied" },
    "6a00": { message: "Error without info" },
    "6a80": { message: "Invalid data" },
    "6b00": { message: "Incorrect parameter P1 or P2" },
    "6d00": { message: "Incorrect parameter INS" },
    "6e00": { message: "Incorrect parameter CLA" },
  };

export class CantonAppCommandError extends DeviceExchangeError<CantonAppErrorCodes> {
  constructor(args: CommandErrorArgs<CantonAppErrorCodes>) {
    super({ tag: "CantonAppCommandError", ...args });
  }
}

export const CantonAppCommandErrorFactory = (
  args: CommandErrorArgs<CantonAppErrorCodes>,
) => new CantonAppCommandError(args);
