import { DeviceExchangeError, UnknownDeviceExchangeError } from "@api/Error";

export enum CommandResultStatus {
  Error = "ERROR",
  Success = "SUCCESS",
}
export type SuccessResult<Data> = {
  status: CommandResultStatus.Success;
  data: Data;
};
export type ErrorResult<SpecificErrorCodes> = {
  error: DeviceExchangeError<SpecificErrorCodes> | UnknownDeviceExchangeError;
  status: CommandResultStatus.Error;
};
export type CommandResult<Data, SpecificErrorCodes> =
  | SuccessResult<Data>
  | ErrorResult<SpecificErrorCodes>;

export const CommandResultFactory = <Data, SpecificErrorCodes>(
  result: CommandResult<Data, SpecificErrorCodes>,
): CommandResult<Data, SpecificErrorCodes> => {
  return result;
};

export const isSuccessCommandResult = <Data, StatusCode>(
  result: CommandResult<Data, StatusCode>,
): result is SuccessResult<Data> =>
  result.status === CommandResultStatus.Success;
