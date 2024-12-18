import { type Observable } from "rxjs";

import { type Command } from "@api/command/Command";
import { type CommandResult } from "@api/command/model/CommandResult";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { type DmkError } from "@api/Error";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { type DeviceActionState } from "./model/DeviceActionState";

export type InternalApi = {
  readonly sendCommand: <Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
  ) => Promise<CommandResult<Response, ErrorStatusCodes>>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly getDeviceSessionStateObservable: () => Observable<DeviceSessionState>;
  readonly setDeviceSessionState: (
    state: DeviceSessionState,
  ) => DeviceSessionState;
  readonly getManagerApiService: () => ManagerApiService;
};

export type DeviceActionIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type ExecuteDeviceActionReturnType<Output, Error, IntermediateValue> = {
  readonly observable: Observable<
    DeviceActionState<Output, Error, IntermediateValue>
  >;
  cancel(): void;
};

export interface DeviceAction<
  Output,
  Input,
  Error extends DmkError,
  IntermediateValue extends DeviceActionIntermediateValue,
> {
  readonly input: Input;

  _execute(
    params: InternalApi,
  ): ExecuteDeviceActionReturnType<Output, Error, IntermediateValue>;
}
