import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type SolanaAppErrorCodes =
  | "6700"
  | "6982"
  | "6985"
  | "6a80"
  | "6a81"
  | "6a82"
  | "6b00"
  | "6d00"
  | "6f10"
  | "6f11"
  | "6f12"
  | "6f13";

export const SOLANA_APP_ERRORS: CommandErrors<SolanaAppErrorCodes> = {
  "6700": { message: "Incorrect length" },
  "6982": { message: "No APDU received" },
  "6985": { message: "Canceled by user" },
  "6a80": { message: "Invalid data" },
  "6a81": { message: "Invalid off-chain message header" },
  "6a82": { message: "Invalid off-chain message format" },
  "6b00": { message: "Invalid instruction descriptor" },
  "6d00": { message: "Instruction not supported" },
  "6f10": { message: "Delayed signing preview not found" },
  "6f11": { message: "Delayed signing hash mismatch" },
  "6f12": { message: "Delayed signing length mismatch" },
  "6f13": { message: "Delayed signing derivation mismatch" },
};

export class SolanaAppCommandError extends DeviceExchangeError<SolanaAppErrorCodes> {
  constructor(args: CommandErrorArgs<SolanaAppErrorCodes>) {
    super({ tag: "SolanaAppCommandError", ...args });
  }
}

export const SolanaAppCommandErrorFactory = (
  args: CommandErrorArgs<SolanaAppErrorCodes>,
) => new SolanaAppCommandError(args);
