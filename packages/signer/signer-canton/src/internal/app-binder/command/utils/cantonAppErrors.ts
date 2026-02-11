import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type CantonErrorCodes =
  | "6700"
  | "6982"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const CANTON_APP_ERRORS: CommandErrors<CantonErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "User refused the operation" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class CantonAppCommandError extends DeviceExchangeError<CantonErrorCodes> {
  constructor(args: CommandErrorArgs<CantonErrorCodes>) {
    super({ tag: "CantonAppCommandError", ...args });
  }
}

export const CantonAppCommandErrorFactory = (
  args: CommandErrorArgs<CantonErrorCodes>,
) => new CantonAppCommandError(args);
