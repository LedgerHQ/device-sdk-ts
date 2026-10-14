import {
  type CommandErrorArgs,
  type CommandErrors,
  type DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

/**
 * How a command turns a status word into an error. Each coin passes its own,
 * so a Zcash command still fails with a ZcashAppCommandError.
 */
export type LegacyErrorConfig<ErrorCodes extends string> = {
  errors: CommandErrors<ErrorCodes>;
  factory: (
    args: CommandErrorArgs<ErrorCodes>,
  ) => DeviceExchangeError<ErrorCodes>;
};
