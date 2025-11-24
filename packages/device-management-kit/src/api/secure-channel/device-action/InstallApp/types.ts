import { type EitherAsync } from "purify-ts";
import { type Observable } from "rxjs";

import { type CommandErrorResult } from "@api/command/model/CommandResult";
import {
  type GetOsVersionCommandResult,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
} from "@api/device-action/os/GoToDashboard/types";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import {
  type InstalledApp,
  type ListInstalledAppsDAInput,
  type ListInstalledAppsDAIntermediateValue,
} from "@api/secure-channel/device-action/ListInstalledApps/types";
import { type SecureChannelEvent } from "@api/secure-channel/task/types";
import { type Input } from "@api/secure-channel/types";
import { type Application } from "@internal/manager-api/model/Application";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import type { SecureChannelInstallDAErrors } from "@internal/secure-channel/model/Errors";

export type InstallAppDAOutput = void;

export type InstallAppDAInput = GoToDashboardDAInput &
  ListInstalledAppsDAInput & { appName: string };

export type InstallAppDAError =
  | CommandErrorResult["error"]
  | GoToDashboardDAError
  | HttpFetchApiError
  | SecureChannelInstallDAErrors
  | UnknownDAError;

export type InstallAppDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.AllowSecureConnection;

export type InstallAppDAIntermediateValue =
  ListInstalledAppsDAIntermediateValue & {
    requiredUserInteraction: InstallAppDARequiredInteraction;
    progress: number;
    deviceId?: Uint8Array;
  };

export type InstallAppDAState = DeviceActionState<
  InstallAppDAOutput,
  InstallAppDAError,
  InstallAppDAIntermediateValue
>;

export type InstallAppStateMachineInternalState = {
  error: InstallAppDAError | null;
  installedApps: Array<InstalledApp>;
  getOsVersionResponse: GetOsVersionResponse | null;
  appList: Array<Application>;
};

export type MachineDependencies = {
  getOsVersion: () => Promise<GetOsVersionCommandResult>;
  getAppList: (
    args: Input<{
      deviceInfo: GetOsVersionResponse;
    }>,
  ) => EitherAsync<HttpFetchApiError, Array<Application>>;
  installApp: (
    args: Input<{ deviceInfo: GetOsVersionResponse; app: Application }>,
  ) => Observable<SecureChannelEvent>;
  getDeviceSessionState: () => DeviceSessionState;
  setDeviceSessionState: (state: DeviceSessionState) => DeviceSessionState;
};
