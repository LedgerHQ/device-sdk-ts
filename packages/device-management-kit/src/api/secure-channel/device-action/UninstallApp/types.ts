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
import { type InstalledApp } from "@api/secure-channel/device-action/ListInstalledApps/types";
import { type SecureChannelEvent } from "@api/secure-channel/task/types";
import { type Input } from "@api/secure-channel/types";
import { type Application } from "@internal/manager-api/model/Application";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";

export type UninstallAppDAOutput = void;

export type UninstallAppDAInput = GoToDashboardDAInput & { appName: string };

export type UninstallAppDAError =
  | CommandErrorResult["error"]
  | GoToDashboardDAError
  | HttpFetchApiError
  | UnknownDAError;

export type UninstallAppDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.AllowSecureConnection;

export type UninstallAppDAIntermediateValue = {
  requiredUserInteraction: UninstallAppDARequiredInteraction;
};

export type UninstallAppDAState = DeviceActionState<
  UninstallAppDAOutput,
  UninstallAppDAError,
  UninstallAppDAIntermediateValue
>;

export type UninstallAppStateMachineInternalState = {
  error: UninstallAppDAError | null;
  installedApps: Array<InstalledApp>;
  appList: Array<Application | null>;
  getOsVersionResponse: GetOsVersionResponse | null;
};

export type MachineDependencies = {
  getOsVersion: () => Promise<GetOsVersionCommandResult>;
  getAppsByHash: (
    args: Input<InstalledApp[]>,
  ) => EitherAsync<HttpFetchApiError, Array<Application | null>>;
  uninstallApp: (
    args: Input<{ deviceInfo: GetOsVersionResponse; app: Application }>,
  ) => Observable<SecureChannelEvent>;
  getDeviceSessionState: () => DeviceSessionState;
  setDeviceSessionState: (state: DeviceSessionState) => DeviceSessionState;
};
