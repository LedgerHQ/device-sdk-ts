import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type SuiAppErrorCodes =
  | "6808"
  | "6982"
  | "6d00"
  | "6e00"
  | "6e01"
  | "6e05";

export const SUI_APP_ERRORS: CommandErrors<SuiAppErrorCodes> = {
  "6808": { message: "Blind signing must be enabled in Settings" },
  "6982": { message: "Nothing received" },
  "6d00": { message: "Invalid data or user rejected" },
  "6e00": { message: "CLA or INS not supported" },
  "6e01": { message: "Invalid length" },
  "6e05": { message: "Swap transaction parameter mismatch" },
};

export class SuiAppCommandError extends DeviceExchangeError<SuiAppErrorCodes> {
  constructor(args: CommandErrorArgs<SuiAppErrorCodes>) {
    super({ tag: "SuiAppCommandError", ...args });
  }
}

export const SuiAppCommandErrorFactory = (
  args: CommandErrorArgs<SuiAppErrorCodes>,
) => new SuiAppCommandError(args);
