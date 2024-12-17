import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type BitcoinAppErrorCodes =
  | "6985"
  | "6A86"
  | "6A87"
  | "6D00"
  | "6E00"
  | "B000"
  | "B007"
  | "B008";

export const BTC_APP_ERRORS: CommandErrors<BitcoinAppErrorCodes> = {
  "6985": { message: "Rejected by user" },
  "6A86": { message: "Either P1 or P2 is incorrect" },
  "6A87": { message: "Lc or minimum APDU length is incorrect" },
  "6D00": { message: "No command exists with the provided INS" },
  "6E00": { message: "Bad CLA used for this application" },
  B000: { message: "Wrong response length (buffer size problem)" },
  B007: { message: "Aborted due to unexpected state reached" },
  B008: { message: "Invalid signature or HMAC" },
};

export class BitcoinAppCommandError extends DeviceExchangeError<BitcoinAppErrorCodes> {
  constructor(args: CommandErrorArgs<BitcoinAppErrorCodes>) {
    super({ tag: "BitcoinAppCommandError", ...args });
  }
}
