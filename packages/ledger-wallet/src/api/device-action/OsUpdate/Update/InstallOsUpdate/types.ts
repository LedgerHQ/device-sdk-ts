import {
  type DeviceActionState,
  type DeviceLockedError,
  type GetOsVersionResponse,
  type GoToDashboardDAError,
  type GoToDashboardDARequiredInteraction,
  type OutOfMemoryDAError,
  type RefusedByUserDAError,
  type SecureChannelError,
  type UnknownDAError,
  type UserInteractionRequired,
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import { type GetOsVersionError } from "@api/device-action/OsUpdate/Shared/OsUpdateDeviceActionErrors";
import { type OsUpdate } from "@api/device-action/OsUpdate/Shared/types";

export type InstallOsUpdateDAInput = {
  osUpdate: OsUpdate;
  unlockTimeout: number;
};

export type SecureChannelUpdateFirmwareDAErrors =
  | SecureChannelError
  | OutOfMemoryDAError
  | DeviceLockedError
  | RefusedByUserDAError
  | UnknownDAError;

export type InstallOsUpdateDAError =
  | WaitForAppAndVersionDAError
  | GoToDashboardDAError
  | GetOsVersionError
  | SecureChannelUpdateFirmwareDAErrors;

export type InstallOsUpdateDARequiredInteraction =
  | WaitForAppAndVersionDARequiredInteraction
  | GoToDashboardDARequiredInteraction
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.AllowSecureConnection
  | UserInteractionRequired.AllowInstallFirmware;

export type InstallOsUpdateDAIntermediateValue = {
  requiredUserInteraction: InstallOsUpdateDARequiredInteraction;
  step: InstallOsUpdateSteps;
  progress?: number;
};

export type InstallOsUpdateDAInternalState = {
  error: InstallOsUpdateDAError | null;
  currentApp: string | null;
  deviceInfo: GetOsVersionResponse | null;
};

export type InstallOsUpdateDAState = DeviceActionState<
  void,
  InstallOsUpdateDAError,
  InstallOsUpdateDAIntermediateValue
>;

export enum InstallOsUpdateSteps {
  Idle = "idle",
  WaitForAppAndVersion = "waitForAppAndVersion",
  GoToDashboard = "goToDashboard",
  GetDeviceInfo = "getDeviceInfo",
  InstallFirmware = "installFirmware",
}
