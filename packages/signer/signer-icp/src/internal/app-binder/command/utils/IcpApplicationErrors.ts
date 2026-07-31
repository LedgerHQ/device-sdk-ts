import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

// Status words are matched against the value produced by
// ApduParser.encodeToHexaString(statusCode): lower-case hex, no "0x" prefix.
export enum IcpErrorCodes {
  EXECUTION_ERROR = "6400",
  WRONG_BUFFER_LENGTH = "6700",
  EMPTY_BUFFER = "6982",
  OUTPUT_BUFFER_TOO_SMALL = "6983",
  DATA_INVALID = "6984",
  CONDITIONS_NOT_SATISFIED = "6985",
  COMMAND_NOT_ALLOWED = "6986",
  TX_NOT_INITIALIZED = "6987",
  BAD_KEY_HANDLE = "6a80",
  P1_P2_INVALID = "6b00",
  INS_NOT_SUPPORTED = "6d00",
  CLA_NOT_SUPPORTED = "6e00",
  UNKNOWN_ERROR = "6f00",
  SIGN_VERIFY_ERROR = "6f01",
  BUSY = "9001",
}

export const ICP_APP_ERRORS: CommandErrors<IcpErrorCodes> = {
  "6400": { message: "Execution Error" },
  "6700": { message: "Wrong buffer length" },
  "6982": { message: "Empty buffer" },
  "6983": { message: "Output buffer too small" },
  "6984": { message: "Data is invalid" },
  "6985": { message: "Conditions not satisfied" },
  "6986": { message: "Command not allowed" },
  "6987": { message: "Tx not initialized" },
  "6a80": { message: "Bad key handle" },
  "6b00": { message: "P1 or P2 invalid" },
  "6d00": { message: "INS not supported" },
  "6e00": { message: "CLA not supported" },
  "6f00": { message: "Unknown error" },
  "6f01": { message: "Sign/verify error" },
  "9001": { message: "Busy" },
};

export class IcpAppCommandError extends DeviceExchangeError<IcpErrorCodes> {
  constructor(args: CommandErrorArgs<IcpErrorCodes>) {
    super({ tag: "IcpAppCommandError", ...args });
  }
}

export const IcpAppCommandErrorFactory = (
  args: CommandErrorArgs<IcpErrorCodes>,
) => new IcpAppCommandError(args);
