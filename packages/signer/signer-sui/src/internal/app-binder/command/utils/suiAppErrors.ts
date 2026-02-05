import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type SuiErrorCodes =
  | "5515" // User denied
  | "6700"
  | "6982"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6e05" // Swap TX param mismatch
  | "6f00";

export const SUI_APP_ERRORS: CommandErrors<SuiErrorCodes> = {
  "5515": { message: "User denied the operation" },
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "Conditions not satisfied" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6e05": { message: "Swap transaction parameter mismatch" },
  "6f00": { message: "Technical problem" },
};

export class SuiAppCommandError extends DeviceExchangeError<SuiErrorCodes> {
  constructor(args: CommandErrorArgs<SuiErrorCodes>) {
    super({ tag: "SuiAppCommandError", ...args });
  }
}

export const SuiAppCommandErrorFactory = (
  args: CommandErrorArgs<SuiErrorCodes>,
) => new SuiAppCommandError(args);
