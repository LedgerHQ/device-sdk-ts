import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDARequiredInteraction,
  type InstallLanguagePackageDAError,
  type InstallLanguagePackageDAIntermediateValue,
  type InstallOrUpdateAppsDAError,
  type InstallOrUpdateAppsDAIntermediateValue,
  type InstallPlan,
  type UserInteractionRequired,
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import {
  type Backup,
  type BackupApp,
} from "@api/device-action/OsUpdate/Backup/types";
import {
  type RestoreAppsStorageDAError,
  type RestoreAppsStorageDARequiredInteraction,
} from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";
import { type RestoreBackupDeviceActionErrors } from "@api/device-action/OsUpdate/Restore/RestoreBackup/RestoreBackupDeviceActionErrors";
import {
  type UploadCustomLockScreenDAError,
  type UploadCustomLockScreenDARequiredInteraction,
} from "@api/device-action/UploadCustomLockScreen/types";

export type RestoreBackupDAInput = {
  backup: Backup;
  unlockTimeout: number;
};

export type RestoreAppResult = {
  appName: string;
  restoredApp: boolean;
  restoredAppStorage: boolean | undefined;
};

export type RestoreBackupDAOutput = {
  restoredLanguage: boolean | undefined;
  restoredCLS: boolean | undefined;
  restoredApps: RestoreAppResult[] | undefined;
};

export type RestoreBackupDAError =
  | WaitForAppAndVersionDAError
  | GoToDashboardDAError
  | InstallLanguagePackageDAError
  | InstallOrUpdateAppsDAError
  | RestoreAppsStorageDAError
  | UploadCustomLockScreenDAError
  | RestoreBackupDeviceActionErrors;

export type RestoreBackupDAIntermediateValue = {
  requiredUserInteraction: RestoreBackupDARequiredInteraction;
  step: RestoreBackupSteps;
  progress?: number;
  installPlan?: InstallPlan | null;
  deviceId?: Uint8Array;
};

export type RestoreBackupDARequiredInteraction =
  | WaitForAppAndVersionDARequiredInteraction
  | GoToDashboardDARequiredInteraction
  | InstallLanguagePackageDAIntermediateValue["requiredUserInteraction"]
  | InstallOrUpdateAppsDAIntermediateValue["requiredUserInteraction"]
  | RestoreAppsStorageDARequiredInteraction
  | UploadCustomLockScreenDARequiredInteraction
  | UserInteractionRequired.None
  | UserInteractionRequired.GrantConsent;

export type RestoreBackupDAInternalState = {
  error: RestoreBackupDAError | null;
  currentApp: string | null;
  isDeviceOnboarded: boolean;
  isMasterConsentGranted: boolean;
  restoredLanguage: boolean | undefined;
  restoredCLS: boolean | undefined;
  restoredApps: RestoreAppResult[] | undefined;
  appsToRestoreStorage: BackupApp[];
};

export type RestoreBackupDAState = DeviceActionState<
  RestoreBackupDAOutput,
  RestoreBackupDAError,
  RestoreBackupDAIntermediateValue
>;

export enum RestoreBackupSteps {
  Idle = "idle",
  WaitForAppAndVersion = "waitForAppAndVersion",
  GoToDashboard = "goToDashboard",
  GetIsOnboarded = "getIsOnboarded",
  RequestMasterConsent = "requestMasterConsent",
  InstallLanguagePackage = "installLanguagePackage",
  InstallOrUpdateApps = "installOrUpdateApps",
  RestoreAppsStorage = "restoreAppsStorage",
  UploadCustomLockScreen = "uploadCustomLockScreen",
}

export enum RequestMasterConsentResult {
  GRANTED = "consentGranted",
  REJECTED = "consentRejected",
}
