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
import { type SecureChannelEvent } from "@api/secure-channel/task/types";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export type Input<T> = { input: T };

export type ListInstalledAppsDAOutput = {
  installedApps: Array<InstalledApp>;
};

export type ListInstalledAppsDAInput = GoToDashboardDAInput;

export type ListInstalledAppsDAError =
  | CommandErrorResult["error"]
  | GoToDashboardDAError
  | HttpFetchApiError
  | UnknownDAError;

export type ListInstalledAppsDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.AllowSecureConnection;

export type ListInstalledAppsDAIntermediateValue = {
  requiredUserInteraction: ListInstalledAppsDARequiredInteraction;
};

export type ListInstalledAppsDAState = DeviceActionState<
  ListInstalledAppsDAOutput,
  ListInstalledAppsDAError,
  ListInstalledAppsDAIntermediateValue
>;

export type ListInstalledAppsStateMachineInternalState = {
  error: ListInstalledAppsDAError | null;
  result: { installedApps: Array<InstalledApp> };
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
  listInstalledApps: (
    args: Input<{
      deviceInfo: GetOsVersionResponse;
      finalFirmware: FinalFirmware;
    }>,
  ) => Observable<SecureChannelEvent>;
  getDeviceSessionState: () => DeviceSessionState;
  setDeviceSessionState: (state: DeviceSessionState) => DeviceSessionState;
};

export type InstalledApp = {
  flags: number;
  hash: string;
  hash_code_data: string;
  name: string;
};

export function installedAppResultGuard(
  value: unknown,
): value is ListInstalledAppsDAOutput["installedApps"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "flags" in item &&
        "hash" in item &&
        "hash_code_data" in item &&
        "name" in item &&
        typeof item.flags === "number" &&
        typeof item.hash === "string" &&
        typeof item.hash_code_data === "string" &&
        typeof item.name === "string",
    )
  );
}
