import {
  type InvalidBatteryDataError,
  type InvalidBatteryStatusTypeError,
  type InvalidResponseFormatError,
  type InvalidStatusWordError,
} from "@api/command/Errors";
import { type GlobalCommandErrorStatusCode } from "@api/command/utils/GlobalCommandError";
import {
  type DeviceExchangeError,
  type UnknownDeviceExchangeError,
} from "@api/Error";

export enum CommandResultStatus {
  Error = "ERROR",
  Success = "SUCCESS",
}
type CommandSuccessResult<Data> = {
  status: CommandResultStatus.Success;
  data: Data;
};
export type CommandErrorResult<SpecificErrorCodes = void> = {
  error:
    | DeviceExchangeError<SpecificErrorCodes | GlobalCommandErrorStatusCode>
    | InvalidBatteryDataError
    | InvalidBatteryStatusTypeError
    | InvalidResponseFormatError
    | InvalidStatusWordError
    | UnknownDeviceExchangeError;
  status: CommandResultStatus.Error;
};
export type CommandResult<Data, SpecificErrorCodes = void> =
  | CommandSuccessResult<Data>
  | CommandErrorResult<SpecificErrorCodes>;

export function CommandResultFactory<Data, SpecificErrorCodes = void>({
  data,
  error,
}:
  | { data: Data; error?: undefined }
  | {
      data?: undefined;
      error:
        | DeviceExchangeError<SpecificErrorCodes>
        | InvalidBatteryDataError
        | InvalidBatteryStatusTypeError
        | InvalidResponseFormatError
        | InvalidStatusWordError
        | UnknownDeviceExchangeError;
    }): CommandResult<Data, SpecificErrorCodes> {
  if (error) {
    return {
      status: CommandResultStatus.Error,
      error,
    };
  }
  return {
    status: CommandResultStatus.Success,
    data,
  };
}

export function isSuccessCommandResult<Data, StatusCode>(
  result: CommandResult<Data, StatusCode>,
): result is CommandSuccessResult<Data> {
  return result.status === CommandResultStatus.Success;
}
