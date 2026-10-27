import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * Tron application APDU error codes.
 *
 * The Tron embedded app is derived from the Ethereum app and shares the same
 * status word conventions. Keys are the lowercase, unprefixed hex status word
 * as produced by `ApduParser.encodeToHexaString` (e.g. "6a80"), which is what
 * `CommandErrorHelper.getError` matches against.
 */
export type TronAppErrorCodes =
  | "6700"
  | "6800"
  | "6982"
  | "6983"
  | "6985"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const TRON_APP_ERRORS: CommandErrors<TronAppErrorCodes> = {
  "6700": { message: "Incorrect length" },
  "6800": { message: "Internal error (Please report)" },
  "6982": { message: "Security status not satisfied (Canceled by user)" },
  "6983": { message: "Wrong data length" },
  "6985": { message: "Condition of use not satisfied (rejected by user)" },
  "6a80": { message: "Incorrect data" },
  "6b00": { message: "Incorrect parameter P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Tron app is not open" },
  "6f00": { message: "Technical problem (Internal error, please report)" },
};

export class TronAppCommandError extends DeviceExchangeError<TronAppErrorCodes> {
  constructor(args: CommandErrorArgs<TronAppErrorCodes>) {
    super({ tag: "TronAppCommandError", ...args });
  }
}

export const TronAppCommandErrorFactory = (
  args: CommandErrorArgs<TronAppErrorCodes>,
) => new TronAppCommandError(args);
