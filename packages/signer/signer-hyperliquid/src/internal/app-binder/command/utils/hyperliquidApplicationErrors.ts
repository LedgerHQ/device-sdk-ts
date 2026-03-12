import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum HyperliquidErrorCodes {
  INVALID_DERIVATION_PATH = "6a80",
  ACTION_PARSING_ERROR = "6a81",
}

export const HYPERLIQUID_ERRORS: CommandErrors<`${HyperliquidErrorCodes}`> = {
  "6a80": { message: "Invalid derivation path" },
  "6a81": { message: "Action parsing error" },
};

export class HyperliquidCommandError extends DeviceExchangeError<HyperliquidErrorCodes> {
  constructor(args: CommandErrorArgs<HyperliquidErrorCodes>) {
    super({ tag: "HyperliquidCommandError", ...args });
  }
}

export const HyperliquidCommandErrorFactory = (
  args: CommandErrorArgs<HyperliquidErrorCodes>,
) => new HyperliquidCommandError(args);
