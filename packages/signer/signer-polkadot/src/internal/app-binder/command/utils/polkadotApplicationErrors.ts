import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum PolkadotErrorCodes {
  EXECUTION_ERROR = "6400",
  WRONG_BUFFER_LENGTH = "6700",
  EMPTY_BUFFER = "6982",
  OUTPUT_BUFFER_TOO_SMALL = "6983",
  DATA_INVALID = "6984",
  COMMAND_NOT_ALLOWED = "6986",
  TX_NOT_INITIALIZED = "6987",
  P1_P2_INVALID = "6b00",
  INS_NOT_SUPPORTED = "6d00",
  CLA_NOT_SUPPORTED = "6e00",
  UNKNOWN_ERROR = "6f00",
  SIGN_VERIFY_ERROR = "6f01",
}

export const POLKADOT_APP_ERRORS: CommandErrors<PolkadotErrorCodes> = {
  "6400": { message: "Execution Error" },
  "6700": { message: "Wrong buffer length" },
  "6982": { message: "Empty buffer" },
  "6983": { message: "Output buffer too small" },
  "6984": { message: "Data is invalid" },
  "6986": { message: "Command not allowed" },
  "6987": { message: "Tx is not initialized" },
  "6b00": { message: "P1/P2 are invalid" },
  "6d00": { message: "INS not supported" },
  "6e00": { message: "CLA not supported" },
  "6f00": { message: "Unknown error" },
  "6f01": { message: "Sign / verify error" },
};

export class PolkadotAppCommandError extends DeviceExchangeError<PolkadotErrorCodes> {
  constructor(args: CommandErrorArgs<PolkadotErrorCodes>) {
    super({ tag: "PolkadotAppCommandError", ...args });
  }
}

export const PolkadotAppCommandErrorFactory = (
  args: CommandErrorArgs<PolkadotErrorCodes>,
) => new PolkadotAppCommandError(args);
