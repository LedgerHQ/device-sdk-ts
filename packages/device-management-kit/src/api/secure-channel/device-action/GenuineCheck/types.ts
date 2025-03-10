import { type EitherAsync } from "purify-ts";
import { type Observable } from "rxjs";

import {
  type GetOsVersionCommandResult,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import { type SecureChannelEvent } from "@api/secure-channel/task/types";
import { type Input } from "@api/secure-channel/types";
import {
  type CommandErrorResult,
  type DeviceSessionState,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
} from "@api/types";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export type GenuineCheckDAOutput = { isGenuine: boolean };

export type GenuineCheckDAInput = GoToDashboardDAInput;

export type GenuineCheckDAError =
  | CommandErrorResult["error"]
  | GoToDashboardDAError
  | HttpFetchApiError
  | UnknownDAError;

export type GenuineCheckDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.AllowSecureConnection;

export type GenuineCheckDAIntermediateValue = {
  requiredUserInteraction: GenuineCheckDARequiredInteraction;
};

export type GenuineCheckDAState = DeviceActionState<
  GenuineCheckDAOutput,
  GenuineCheckDAError,
  GenuineCheckDAIntermediateValue
>;

export type GenuineCheckStateMachineInternalState = {
  error: GenuineCheckDAError | null;
  result: { isGenuine: boolean };
  getOsVersionResponse: GetOsVersionResponse | null;
  deviceVersion: DeviceVersion | null;
  firmwareVersion: FinalFirmware | null;
};

export type MachineDependencies = {
  getOsVersion: () => Promise<GetOsVersionCommandResult>;
  getDeviceVersion: (
    args: Input<{ deviceInfo: GetOsVersionResponse }>,
  ) => EitherAsync<HttpFetchApiError, DeviceVersion>;
  getFirmwareVersion: (
    args: Input<{
      deviceInfo: GetOsVersionResponse;
      deviceVersion: DeviceVersion;
    }>,
  ) => EitherAsync<HttpFetchApiError, FinalFirmware>;
  genuineCheck: (
    args: Input<{
      deviceInfo: GetOsVersionResponse;
      finalFirmware: FinalFirmware;
    }>,
  ) => Observable<SecureChannelEvent>;
  getDeviceSessionState: () => DeviceSessionState;
  setDeviceSessionState: (state: DeviceSessionState) => DeviceSessionState;
};
