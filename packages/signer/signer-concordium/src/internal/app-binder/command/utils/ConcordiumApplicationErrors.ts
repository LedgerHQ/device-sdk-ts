import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum ConcordiumErrorCodes {
  USER_REJECTED = "6985",
  LOCKED_DEVICE = "5515",
  DATA_INVALID = "6a80",
  INS_NOT_SUPPORTED = "6d00",
  CLA_NOT_SUPPORTED = "6e00",
  UNKNOWN_ERROR = "6f00",
}

export const CONCORDIUM_APP_ERRORS: CommandErrors<ConcordiumErrorCodes> = {
  "6985": { message: "User rejected" },
  "5515": { message: "Locked device" },
  "6a80": { message: "Data invalid" },
  "6d00": { message: "INS not supported" },
  "6e00": { message: "CLA not supported" },
  "6f00": { message: "Unknown error" },
};

export class ConcordiumAppCommandError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(args: CommandErrorArgs<ConcordiumErrorCodes>) {
    super({ tag: "ConcordiumAppCommandError", ...args });
  }
}

export const ConcordiumAppCommandErrorFactory = (
  args: CommandErrorArgs<ConcordiumErrorCodes>,
) => new ConcordiumAppCommandError(args);
