import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAIntermediateValue,
  type GoToDashboardDARequiredInteraction,
  type HexaString,
  type InstalledApp,
  type ListInstalledAppsDAError,
  type ListInstalledAppsDAIntermediateValue,
  type ListInstalledAppsDARequiredInteraction,
  type UserInteractionRequired,
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDAIntermediateValue,
  type WaitForAppAndVersionDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import {
  type DownloadCustomLockScreenDAError,
  type DownloadCustomLockScreenDAIntermediateValue,
  type DownloadCustomLockScreenDARequiredInteraction,
} from "@api/device-action/DownloadCustomLockScreen/types";
import { type CreateBackupDeviceActionErrors } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";

export type CreateBackupDAInput = {
  unlockTimeout: number;
};

export type CreateBackupDAOutput = Backup;

export type CreateBackupDAError =
  | WaitForAppAndVersionDAError
  | GoToDashboardDAError
  | ListInstalledAppsDAError
  | DownloadCustomLockScreenDAError
  | CreateBackupDeviceActionErrors;

export type CreateBackupDAIntermediateValue = (
  | WaitForAppAndVersionDAIntermediateValue
  | GoToDashboardDAIntermediateValue
  | ListInstalledAppsDAIntermediateValue
  | DownloadCustomLockScreenDAIntermediateValue
) & {
  step: CreateBackupSteps;
};

export type CreateBackupDARequiredInteraction =
  | WaitForAppAndVersionDARequiredInteraction
  | GoToDashboardDARequiredInteraction
  | ListInstalledAppsDARequiredInteraction
  | DownloadCustomLockScreenDARequiredInteraction
  | UserInteractionRequired.None;

export type CreateBackupDAInternalState = {
  error: CreateBackupDAError | null;
  currentApp: string | null;
  isDeviceOnboarded: boolean;
  languageId: number | undefined;
  installedApps: InstalledApp[];
  backupApps: BackupApp[];
  clsHexImage: string | undefined;
};

export type CreateBackupDAState = DeviceActionState<
  CreateBackupDAOutput,
  CreateBackupDAError,
  CreateBackupDAIntermediateValue
>;

export enum CreateBackupSteps {
  Idle = "idle",
  WaitForAppAndVersion = "waitForAppAndVersion",
  GoToDashboard = "goToDashboard",
  GetIsOnboarded = "getIsOnboarded",
  GetLanguage = "getLanguage",
  ListInstalledApps = "listInstalledApps",
  BackupAppsStorage = "backupAppsStorage",
  DownloadCustomLockScreen = "downloadCustomLockScreen",
}

export type BackupApp = {
  appName: string;
  data: HexaString | undefined;
};

export type Backup = {
  languageId: number | undefined;
  installedApps: BackupApp[];
  clsHexImage: string | undefined;
  createdAt: Date;
};
