import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type SolanaAppErrorCodes =
  | "6700"
  | "6982"
  | "6a80"
  | "6a81"
  | "6a82"
  | "6b00";

export const SOLANA_APP_ERRORS: CommandErrors<SolanaAppErrorCodes> = {
  "6700": { message: "Incorrect length" },
  "6982": { message: "Security status not satisfied (Canceled by user)" },
  "6a80": { message: "Invalid data" },
  "6a81": { message: "Invalid off-chain message header" },
  "6a82": { message: "Invalid off-chain message format" },
  "6b00": { message: "Incorrect parameter P1 or P2" },
};

export class SolanaAppCommandError extends DeviceExchangeError<SolanaAppErrorCodes> {
  constructor(args: CommandErrorArgs<SolanaAppErrorCodes>) {
    super({ tag: "SolanaAppCommandError", ...args });
  }
}

export const SolanaAppCommandErrorFactory = (
  args: CommandErrorArgs<SolanaAppErrorCodes>,
) => new SolanaAppCommandError(args);
