import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type LedgerSyncErrorCodes =
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

export const LEDGER_SYNC_ERRORS: CommandErrors<LedgerSyncErrorCodes> = {
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

export class LedgerSyncError extends DeviceExchangeError<LedgerSyncErrorCodes> {
  constructor(args: CommandErrorArgs<LedgerSyncErrorCodes>) {
    super({ tag: "LedgerSyncError", ...args });
  }
}

export const LedgerSyncErrorFactory = (
  args: CommandErrorArgs<LedgerSyncErrorCodes>,
) => new LedgerSyncError(args);
