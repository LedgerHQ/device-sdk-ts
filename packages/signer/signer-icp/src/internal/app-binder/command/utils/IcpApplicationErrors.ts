import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum IcpErrorCodes {
  EXECUTION_ERROR = "0x6400",
  WRONG_BUFFER_LENGTH = "0x6700",
  EMPTY_BUFFER = "0x6982",
  OUTPUT_BUFFER_TOO_SMALL = "0x6983",
  DATA_INVALID = "0x6984",
  CONDITIONS_NOT_SATISFIED = "0x6985",
  COMMAND_NOT_ALLOWED = "0x6986",
  TX_NOT_INITIALIZED = "0x6987",
  BAD_KEY_HANDLE = "0x6A80",
  P1_P2_INVALID = "0x6B00",
  INS_NOT_SUPPORTED = "0x6D00",
  CLA_NOT_SUPPORTED = "0x6E00",
  UNKNOWN_ERROR = "0x6F00",
  SIGN_VERIFY_ERROR = "0x6F01",
  BUSY = "0x9001",
}

export const ICP_APP_ERRORS: CommandErrors<IcpErrorCodes> = {
  "0x6400": { message: "Execution Error" },
  "0x6700": { message: "Wrong buffer length" },
  "0x6982": { message: "Empty buffer" },
  "0x6983": { message: "Output buffer too small" },
  "0x6984": { message: "Data is invalid" },
  "0x6985": { message: "Conditions not satisfied" },
  "0x6986": { message: "Command not allowed" },
  "0x6987": { message: "Tx not initialized" },
  "0x6A80": { message: "Bad key handle" },
  "0x6B00": { message: "P1 or P2 invalid" },
  "0x6D00": { message: "INS not supported" },
  "0x6E00": { message: "CLA not supported" },
  "0x6F00": { message: "Unknown error" },
  "0x6F01": { message: "Sign/verify error" },
  "0x9001": { message: "Busy" },
};

export class IcpAppCommandError extends DeviceExchangeError<IcpErrorCodes> {
  constructor(args: CommandErrorArgs<IcpErrorCodes>) {
    super({ tag: "IcpAppCommandError", ...args });
  }
}

export const IcpAppCommandErrorFactory = (
  args: CommandErrorArgs<IcpErrorCodes>,
) => new IcpAppCommandError(args);
