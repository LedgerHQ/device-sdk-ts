import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type CeloErrorCodes =
  | "6700"
  | "6804"
  | "6982"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00";

export const CELO_APP_ERRORS: CommandErrors<CeloErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6804": { message: "Unknown error" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "User refused the operation" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
};

export class CeloAppCommandError extends DeviceExchangeError<CeloErrorCodes> {
  constructor(args: CommandErrorArgs<CeloErrorCodes>) {
    super({ tag: "CeloAppCommandError", ...args });
  }
}

export const CeloAppCommandErrorFactory = (
  args: CommandErrorArgs<CeloErrorCodes>,
) => new CeloAppCommandError(args);
