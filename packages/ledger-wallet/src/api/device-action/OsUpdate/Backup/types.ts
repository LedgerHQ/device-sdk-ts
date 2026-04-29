import {
  type DeviceActionState,
  type InstalledApp,
  type KeyValueStorage,
  type ListInstalledAppsDAError,
  type ListInstalledAppsDAIntermediateValue,
  type ListInstalledAppsDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type DownloadCustomLockScreenDAError,
  type DownloadCustomLockScreenDAIntermediateValue,
  type DownloadCustomLockScreenDARequiredInteraction,
} from "@api/device-action/DownloadCustomLockScreen/types";
import { type BackupDeviceActionErrors } from "@api/device-action/OsUpdate/Backup/BackupDeviceActionErrors";

export type BackupDAInput = {
  isDeviceOnboarded: boolean;
  deviceId: string;
  storage: KeyValueStorage;
  unlockTimeout: number;
};

export type BackupDAOutput = void;

export type BackupDAError =
  | ListInstalledAppsDAError
  | DownloadCustomLockScreenDAError
  | BackupDeviceActionErrors;

export type BackupDAIntermediateValue = (
  | ListInstalledAppsDAIntermediateValue
  | DownloadCustomLockScreenDAIntermediateValue
) & {
  step: BackupSteps;
};

export type BackupDARequiredInteraction =
  | ListInstalledAppsDARequiredInteraction
  | DownloadCustomLockScreenDARequiredInteraction
  | UserInteractionRequired.None;

export type BackupDAInternalState = {
  error: BackupDAError | null;
  languageId: number | undefined;
  installedApps: InstalledApp[];
  backupApps: BackupApp[];
  clsHexImage: string | undefined;
  backupAlreadyExist: boolean;
};

export type BackupDAState = DeviceActionState<
  BackupDAOutput,
  BackupDAError,
  BackupDAIntermediateValue
>;

export enum BackupSteps {
  Idle = "idle",
  GetLanguage = "getLanguage",
  ListInstalledApps = "listInstalledApps",
  BackupAppsStorage = "backupAppsStorage",
  DownloadCustomLockScreen = "downloadCustomLockScreen",
  SaveBackup = "saveBackup",
}

export type BackupApp = {
  appName: string;
  data: string | undefined;
};

export type Backup = {
  languageId: number | undefined;
  installedApps: BackupApp[];
  clsHexImage: string | undefined;
  createdAt: Date;
};
