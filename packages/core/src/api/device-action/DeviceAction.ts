import { Observable } from "rxjs";

import { Command } from "@api/command/Command";
import { CommandResult } from "@api/command/model/CommandResult";
import { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { SdkError } from "@api/Error";
import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { DeviceActionState } from "./model/DeviceActionState";

export type InternalApi = {
  readonly sendCommand: <Response, ErrorStatusCodes, Args>(
    command: Command<Response, ErrorStatusCodes, Args>,
  ) => Promise<CommandResult<Response, ErrorStatusCodes>>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly getDeviceSessionStateObservable: () => Observable<DeviceSessionState>;
  readonly setDeviceSessionState: (
    state: DeviceSessionState,
  ) => DeviceSessionState;
  getMetadataForAppHashes: ManagerApiService["getAppsByHash"];
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
  Error extends SdkError,
  IntermediateValue extends DeviceActionIntermediateValue,
> {
  readonly input: Input;

  _execute(
    params: InternalApi,
  ): ExecuteDeviceActionReturnType<Output, Error, IntermediateValue>;
}
