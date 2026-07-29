import {
  type DeleteLanguagePackDAError,
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAIntermediateValue,
  type GoToDashboardDARequiredInteraction,
  type InstalledApp,
  type ListInstalledAppsDAError,
  type ListInstalledAppsDAIntermediateValue,
  type ListInstalledAppsDARequiredInteraction,
  type UninstallAppDAError,
  type UninstallAppDAIntermediateValue,
  type UninstallAppDARequiredInteraction,
  type UserInteractionRequired,
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDAIntermediateValue,
  type WaitForAppAndVersionDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import {
  type GetCustomLockScreenInfoDAError,
  type GetCustomLockScreenInfoDAIntermediateValue,
  type GetCustomLockScreenInfoDARequiredInteraction,
} from "@api/device-action/GetCustomLockScreenInfo/types";
import {
  type RemoveCustomLockScreenDAError,
  type RemoveCustomLockScreenDAIntermediateValue,
  type RemoveCustomLockScreenDARequiredInteraction,
} from "@api/device-action/RemoveCustomLockScreen/types";

export type CleanDeviceDAInput = {
  unlockTimeout: number;
};

export type CleanDeviceDAOutput = void;

export type CleanDeviceDAError =
  | WaitForAppAndVersionDAError
  | GoToDashboardDAError
  | ListInstalledAppsDAError
  | UninstallAppDAError
  | DeleteLanguagePackDAError
  | GetCustomLockScreenInfoDAError
  | RemoveCustomLockScreenDAError;

export type CleanDeviceDAIntermediateValue = (
  | WaitForAppAndVersionDAIntermediateValue
  | GoToDashboardDAIntermediateValue
  | ListInstalledAppsDAIntermediateValue
  | UninstallAppDAIntermediateValue
  | GetCustomLockScreenInfoDAIntermediateValue
  | RemoveCustomLockScreenDAIntermediateValue
  | { readonly requiredUserInteraction: UserInteractionRequired.None }
) & {
  step: CleanDeviceSteps;
};

export type CleanDeviceDARequiredInteraction =
  | WaitForAppAndVersionDARequiredInteraction
  | GoToDashboardDARequiredInteraction
  | ListInstalledAppsDARequiredInteraction
  | UninstallAppDARequiredInteraction
  | GetCustomLockScreenInfoDARequiredInteraction
  | RemoveCustomLockScreenDARequiredInteraction
  | UserInteractionRequired.None;

export type CleanDeviceDAInternalState = {
  error: CleanDeviceDAError | null;
  currentApp: string | null;
  installedApps: InstalledApp[];
  currentAppIndex: number;
  hasCustomLockScreen: boolean;
};

export type CleanDeviceDAState = DeviceActionState<
  CleanDeviceDAOutput,
  CleanDeviceDAError,
  CleanDeviceDAIntermediateValue
>;

export enum CleanDeviceSteps {
  Idle = "idle",
  WaitForAppAndVersion = "waitForAppAndVersion",
  GoToDashboard = "goToDashboard",
  ListInstalledApps = "listInstalledApps",
  UninstallApps = "uninstallApps",
  DeleteLanguagePack = "deleteLanguagePack",
  GetCustomLockScreenInfo = "getCustomLockScreenInfo",
  RemoveCustomLockScreen = "removeCustomLockScreen",
}
