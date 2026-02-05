import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type VechainErrorCodes =
  | "6700"
  | "6982"
  | "6985" // User rejected
  | "6a80" // Contract data not enabled
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const VECHAIN_APP_ERRORS: CommandErrors<VechainErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "User rejected the operation" },
  "6a80": { message: "Please enable contract data in Vechain app settings" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class VechainAppCommandError extends DeviceExchangeError<VechainErrorCodes> {
  constructor(args: CommandErrorArgs<VechainErrorCodes>) {
    super({ tag: "VechainAppCommandError", ...args });
  }
}

export const VechainAppCommandErrorFactory = (
  args: CommandErrorArgs<VechainErrorCodes>,
) => new VechainAppCommandError(args);
