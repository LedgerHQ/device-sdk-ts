import { type Either } from "purify-ts";
import { type Observable } from "rxjs";

import { type Command } from "@api/command/Command";
import { type CommandResult } from "@api/command/model/CommandResult";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { type DmkError } from "@api/Error";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import { type DeviceActionState } from "./model/DeviceActionState";

export type InternalApi = {
  readonly sendApdu: (
    apdu: Uint8Array,
  ) => Promise<Either<DmkError, ApduResponse>>;
  readonly sendCommand: <Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
    abortTimeout?: number,
  ) => Promise<CommandResult<Response, ErrorStatusCodes>>;
  readonly getDeviceModel: () => TransportDeviceModel;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly getDeviceSessionStateObservable: () => Observable<DeviceSessionState>;
  readonly setDeviceSessionState: (
    state: DeviceSessionState,
  ) => DeviceSessionState;
  readonly getManagerApiService: () => ManagerApiService;
  readonly getSecureChannelService: () => SecureChannelService;
  readonly loggerFactory?: (tag: string) => LoggerPublisherService;
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
