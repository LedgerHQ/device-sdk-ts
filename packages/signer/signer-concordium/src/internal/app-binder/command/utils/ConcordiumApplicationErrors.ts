import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum ConcordiumErrorCodes {
  USER_REJECTED = "0x6985",
  LOCKED_DEVICE = "0x5515",
  DATA_INVALID = "0x6a80",
  INS_NOT_SUPPORTED = "0x6D00",
  CLA_NOT_SUPPORTED = "0x6E00",
  UNKNOWN_ERROR = "0x6F00",
}

export const CONCORDIUM_APP_ERRORS: CommandErrors<ConcordiumErrorCodes> = {
  "0x6985": { message: "User rejected" },
  "0x5515": { message: "Locked device" },
  "0x6a80": { message: "Data invalid" },
  "0x6D00": { message: "INS not supported" },
  "0x6E00": { message: "CLA not supported" },
  "0x6F00": { message: "Unknown error" },
};

export class ConcordiumAppCommandError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(args: CommandErrorArgs<ConcordiumErrorCodes>) {
    super({ tag: "ConcordiumAppCommandError", ...args });
  }
}

export const ConcordiumAppCommandErrorFactory = (
  args: CommandErrorArgs<ConcordiumErrorCodes>,
) => new ConcordiumAppCommandError(args);
