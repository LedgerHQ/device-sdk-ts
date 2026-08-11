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
  | "6981"
  | "6982"
  | "6985"
  | "6a80"
  | "6a84"
  | "6a87"
  | "6a88"
  | "6a89"
  | "6a8a"
  | "6a8b"
  | "6a8c"
  | "6a8d"
  | "6a8e"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

// Status words as defined by the Tron embedded app (`app_errors.h`), see
// https://github.com/LedgerHQ/app-tron/blob/develop/docs/APDU.md#app-specific-status-words
export const TRON_APP_ERRORS: CommandErrors<TronAppErrorCodes> = {
  "6700": { message: "Incorrect length" },
  "6800": { message: "Missing critical parameter" },
  "6981": { message: "Command incompatible with file structure" },
  "6982": { message: "Security status not satisfied (canceled by user)" },
  "6985": { message: "Condition of use not satisfied (rejected by user)" },
  "6a80": { message: "Incorrect data" },
  "6a84": { message: "Not enough memory space" },
  "6a87": { message: "Wrong data length" },
  "6a88": { message: "Referenced data not found" },
  "6a89": { message: "File already exists" },
  "6a8a": { message: "Incorrect BIP32 path" },
  "6a8b": {
    message: "The 'sign data' setting is required (enable it in the Tron app)",
  },
  "6a8c": {
    message:
      "The 'sign by hash' setting is required (enable it in the Tron app)",
  },
  "6a8d": {
    message:
      "The 'sign custom contracts' setting is required (enable it in the Tron app)",
  },
  "6a8e": { message: "Swap parameters verification failed" },
  "6b00": { message: "Incorrect parameter P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "CLA not supported (wrong class byte)" },
  "6f00": { message: "Technical problem (internal error, please report)" },
};

export class TronAppCommandError extends DeviceExchangeError<TronAppErrorCodes> {
  constructor(args: CommandErrorArgs<TronAppErrorCodes>) {
    super({ tag: "TronAppCommandError", ...args });
  }
}

export const TronAppCommandErrorFactory = (
  args: CommandErrorArgs<TronAppErrorCodes>,
) => new TronAppCommandError(args);
