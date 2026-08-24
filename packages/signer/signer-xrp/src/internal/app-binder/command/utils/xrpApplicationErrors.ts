import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * Status words returned by the XRP application.
 *
 * Source of truth: `LedgerHQ/app-xrp` (branch `develop`) `src/apdu/entry.c`,
 * `src/apdu/messages/*.c` and `doc/xrpapp.asc`.
 *
 * Note: on a transaction parsing failure the app answers `0x6800 | (exception &
 * 0x7ff)`, so the whole `6800`-`6fff` range may be returned. Only the anchors
 * of that range are mapped here; any unmapped status word is surfaced as a
 * generic device exchange error by the kit.
 */
export type XrpErrorCodes =
  | "6700"
  | "6800"
  | "6982"
  | "6985"
  | "6a80"
  | "6a81"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const XRP_APP_ERRORS: CommandErrors<XrpErrorCodes> = {
  "6700": { message: "Incorrect length, or transaction too large" },
  "6800": { message: "Missing critical parameter" },
  "6982": { message: "Security status not satisfied (Canceled by user)" },
  "6985": { message: "Condition of use not satisfied (Rejected by user)" },
  "6a80": { message: "Invalid data" },
  "6a81": { message: "Invalid derivation path" },
  "6b00": { message: "Incorrect parameter P1 or P2" },
  "6d00": { message: "Incorrect parameter INS" },
  "6e00": { message: "Incorrect parameter CLA" },
  "6f00": { message: "Technical problem (Internal error, please report)" },
};

export class XrpAppCommandError extends DeviceExchangeError<XrpErrorCodes> {
  constructor(args: CommandErrorArgs<XrpErrorCodes>) {
    super({ tag: "XrpAppCommandError", ...args });
  }
}

export const XrpAppCommandErrorFactory = (
  args: CommandErrorArgs<XrpErrorCodes>,
) => new XrpAppCommandError(args);
