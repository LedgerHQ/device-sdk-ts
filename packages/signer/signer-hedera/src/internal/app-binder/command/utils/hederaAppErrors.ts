import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type HederaErrorCodes =
  | "6700"
  | "6982"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const HEDERA_APP_ERRORS: CommandErrors<HederaErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "User refused the operation" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class HederaAppCommandError extends DeviceExchangeError<HederaErrorCodes> {
  constructor(args: CommandErrorArgs<HederaErrorCodes>) {
    super({ tag: "HederaAppCommandError", ...args });
  }
}

export const HederaAppCommandErrorFactory = (
  args: CommandErrorArgs<HederaErrorCodes>,
) => new HederaAppCommandError(args);
