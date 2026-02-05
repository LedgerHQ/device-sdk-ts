import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * Stellar Ledger App Error Codes
 */
export type StellarErrorCodes =
  | "6700"
  | "6985"
  | "6c66"
  | "b004"
  | "b005"
  | "6d00"
  | "6e00"
  | "6f00";

export const STELLAR_APP_ERRORS: CommandErrors<StellarErrorCodes> = {
  "6700": { message: "Wrong data length" },
  "6985": { message: "User refused the operation" },
  "6c66": { message: "Hash signing not enabled" },
  "b004": { message: "Data too large" },
  "b005": { message: "Data parsing failed" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class StellarAppCommandError extends DeviceExchangeError<StellarErrorCodes> {
  constructor(args: CommandErrorArgs<StellarErrorCodes>) {
    super({ tag: "StellarAppCommandError", ...args });
  }
}

export const StellarAppCommandErrorFactory = (
  args: CommandErrorArgs<StellarErrorCodes>,
) => new StellarAppCommandError(args);
