import {
  type CommandErrorArgs,
  type CommandErrorResult,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type LedgerKeyRingProtocolErrorCodes =
  | "6985"
  | "6a86"
  | "6a87"
  | "6d00"
  | "6e00"
  | "b000"
  | "b007"
  | "b008"
  | "b009"
  | "b00a"
  | "b00b"
  | "b00c";

export type LKRPDeviceCommandError =
  CommandErrorResult<LedgerKeyRingProtocolErrorCodes>["error"];

export const LEDGER_SYNC_ERRORS: CommandErrors<LedgerKeyRingProtocolErrorCodes> =
  {
    "6985": { message: "Rejected by user" },
    "6a86": { message: "Either P1 or P2 is incorrect" },
    "6a87": { message: "Lc or minimum APDU length is incorrect" },
    "6d00": { message: "No command exists with INS" },
    "6e00": { message: "Bad CLA used for this application" },
    b000: { message: "Wrong response length (buffer size problem)" },
    b007: { message: "Security issue with bad state" },
    b008: { message: "Signature of raw transaction failed" },
    b009: { message: "Security issue lead by an invalid Command stream" },
    b00a: { message: "Invalid or unsupported command stream format" },
    b00b: { message: "Trusted properties buffer can't receive all data" },
    b00c: { message: "Attempt to perform an action on a closed stream" },
  };

export class LedgerKeyRingProtocolError extends DeviceExchangeError<LedgerKeyRingProtocolErrorCodes> {
  constructor(args: CommandErrorArgs<LedgerKeyRingProtocolErrorCodes>) {
    super({ tag: "LedgerKeyRingProtocolError", ...args });
  }
}

export const LedgerKeyRingProtocolErrorFactory = (
  args: CommandErrorArgs<LedgerKeyRingProtocolErrorCodes>,
) => new LedgerKeyRingProtocolError(args);
