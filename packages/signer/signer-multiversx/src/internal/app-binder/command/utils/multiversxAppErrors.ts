import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type MultiversxErrorCodes =
  | "6700"
  | "6982"
  | "6985"
  | "6e00"
  | "6e01"
  | "6e02"
  | "6e03"
  | "6e04"
  | "6e07"
  | "6e10"
  | "6e11"
  | "6d00";

export const MULTIVERSX_APP_ERRORS: CommandErrors<MultiversxErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6985": { message: "User refused the operation" },
  "6e00": { message: "Wrong CLA" },
  "6e01": { message: "Invalid arguments" },
  "6e02": { message: "Invalid message" },
  "6e03": { message: "Invalid P1" },
  "6e04": { message: "Message too long" },
  "6e07": { message: "Contract data disabled" },
  "6e10": { message: "Signature failed" },
  "6e11": { message: "Sign TX deprecated - use hash signing" },
  "6d00": { message: "Unknown instruction" },
};

export class MultiversxAppCommandError extends DeviceExchangeError<MultiversxErrorCodes> {
  constructor(args: CommandErrorArgs<MultiversxErrorCodes>) {
    super({ tag: "MultiversxAppCommandError", ...args });
  }
}

export const MultiversxAppCommandErrorFactory = (
  args: CommandErrorArgs<MultiversxErrorCodes>,
) => new MultiversxAppCommandError(args);
