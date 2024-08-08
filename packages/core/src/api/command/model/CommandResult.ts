import { DeviceExchangeError, SdkError } from "@api/Error";

export enum CommandResultStatus {
  Error = "ERROR",
  Success = "SUCCESS",
}
export type SuccessResult<Data> = {
  status: CommandResultStatus.Success;
  data: Data;
};
export type ErrorResult<SpecificErrorCodes> = {
  error: DeviceExchangeError<SpecificErrorCodes> | SdkError;
  status: CommandResultStatus.Error;
};
/**
 * @type CommandResult
 *
 */
export type CommandResult<Data, SpecificErrorCodes> =
  | SuccessResult<Data>
  | ErrorResult<SpecificErrorCodes>;

export const CommandResultFactory = <Data, SpecificErrorCodes>({
  data,
  error,
}:
  | { data: Data; error?: undefined }
  | {
      data?: undefined;
      error: DeviceExchangeError<SpecificErrorCodes> | SdkError;
    }): CommandResult<Data, SpecificErrorCodes> => {
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
};

export const isSuccessCommandResult = <Data, StatusCode>(
  result: CommandResult<Data, StatusCode>,
): result is SuccessResult<Data> =>
  result.status === CommandResultStatus.Success;
