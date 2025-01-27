import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type BtcErrorCodes =
  | "6a80"
  | "6a82"
  | "6985"
  | "6a86"
  | "6a87"
  | "6d00"
  | "6e00"
  | "b000"
  | "b007"
  | "b008";

export const BTC_APP_ERRORS: CommandErrors<BtcErrorCodes> = {
  "6a80": { message: "Incorrect data" },
  "6a82": { message: "Request not supported" },
  "6985": { message: "Rejected by user" },
  "6a86": { message: "Either P1 or P2 is incorrect" },
  "6a87": { message: "Lc or minimum APDU length is incorrect" },
  "6d00": { message: "No command exists with the provided INS" },
  "6e00": { message: "Bad CLA used for this application" },
  b000: { message: "Wrong response length (buffer size problem)" },
  b007: { message: "Aborted due to unexpected state reached" },
  b008: { message: "Invalid signature or HMAC" },
};

export class BtcAppCommandError extends DeviceExchangeError<BtcErrorCodes> {
  constructor(args: CommandErrorArgs<BtcErrorCodes>) {
    super({ tag: "BtcAppCommandError", ...args });
  }
}

export const BtcAppCommandErrorFactory = (
  args: CommandErrorArgs<BtcErrorCodes>,
) => new BtcAppCommandError(args);
