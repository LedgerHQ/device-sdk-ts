import type {
  InvalidResponseFormatError,
  InvalidStatusWordError,
} from "@api/command/Errors";
import type { GlobalCommandErrorStatusCode } from "@api/command/utils/GlobalCommandError";
import type {
  DeviceExchangeError,
  UnknownDeviceExchangeError,
} from "@api/Error";
import type {
  DmkErrorResult,
  DmkResult,
  DmkSuccessResult,
} from "@api/model/DmkResult";
import {
  DmkResultFactory,
  DmkResultStatus,
  isSuccessDmkResult,
} from "@api/model/DmkResult";

export { DmkResultStatus as CommandResultStatus };
type CommandError<SpecificErrorCodes = void> =
  | DeviceExchangeError<SpecificErrorCodes | GlobalCommandErrorStatusCode>
  | InvalidResponseFormatError
  | InvalidStatusWordError
  | UnknownDeviceExchangeError;

export type CommandSuccessResult<Data> = DmkSuccessResult<Data>;
export type CommandErrorResult<SpecificErrorCodes = void> = DmkErrorResult<
  CommandError<SpecificErrorCodes>
>;
export type CommandResult<Data, SpecificErrorCodes = void> = DmkResult<
  Data,
  CommandError<SpecificErrorCodes>
>;

export function CommandResultFactory<Data, SpecificErrorCodes = void>({
  data,
  error,
}:
  | { data: Data; error?: undefined }
  | {
      data?: undefined;
      error: CommandError<SpecificErrorCodes>;
    }): CommandResult<Data, SpecificErrorCodes> {
  if (error !== undefined) {
    return DmkResultFactory({
      error,
    });
  }

  return DmkResultFactory({
    data,
  });
}

export function isSuccessCommandResult<Data, StatusCode>(
  result: CommandResult<Data, StatusCode>,
): result is CommandSuccessResult<Data> {
  return isSuccessDmkResult(result);
}
