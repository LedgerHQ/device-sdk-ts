import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDARequiredInteraction,
  type HexaString,
  type UserInteractionRequired,
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import { type BackupApp } from "@api/device-action/OsUpdate/Backup/types";
import { type RestoreAppsStorageDeviceActionErrors } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";

export type RestoreAppsStorageDAInput = {
  backupApps: BackupApp[];
  isMasterConsentGranted: boolean;
  unlockTimeout: number;
};

export type RestoreAppStorageResult = {
  appName: string;
  restoredAppStorage: boolean;
};

export type RestoreAppsStorageDAOutput = RestoreAppStorageResult[];

export type RestoreAppsStorageDAError =
  | WaitForAppAndVersionDAError
  | GoToDashboardDAError
  | RestoreAppsStorageDeviceActionErrors;

export type RestoreAppsStorageDARequiredInteraction =
  | WaitForAppAndVersionDARequiredInteraction
  | GoToDashboardDARequiredInteraction
  | UserInteractionRequired.None
  | UserInteractionRequired.GrantConsent;

export type RestoreAppsStorageDAIntermediateValue = {
  requiredUserInteraction: RestoreAppsStorageDARequiredInteraction;
  step: RestoreAppsStorageSteps;
};

// A BackupApp whose storage `data` is known to be defined, i.e. it was
// actually backed up and therefore has app storage to restore.
export type BackupAppWithStorage = BackupApp & { data: HexaString };

export type RestoreAppsStorageDAInternalState = {
  error: RestoreAppsStorageDAError | null;
  currentApp: string | null;
  appsWithStorage: BackupAppWithStorage[];
  currentAppStorageIndex: number;
  currentAppStorageName: string | null;
  currentAppStorageDataBytes: Uint8Array | null;
  currentAppStorageDataLength: number | null;
  restoreAppsStorageResult: RestoreAppStorageResult[];
};

export type RestoreAppsStorageDAState = DeviceActionState<
  RestoreAppsStorageDAOutput,
  RestoreAppsStorageDAError,
  RestoreAppsStorageDAIntermediateValue
>;

export enum RestoreAppsStorageSteps {
  Idle = "idle",
  WaitForAppAndVersion = "waitForAppAndVersion",
  GoToDashboard = "goToDashboard",
  FilterAppsWithStorage = "filterAppsWithStorage",
  ExtractAppData = "extractAppData",
  InitRestoreAppStorage = "initRestoreAppStorage",
  RestoreAppStorage = "restoreAppStorage",
  CommitRestoreAppStorage = "commitRestoreAppStorage",
}

// Outcome of the consent prompt triggered by InitRestoreAppStorageCommand.
export enum InitRestoreAppStorageConsentResult {
  GRANTED = "consentGranted",
  REJECTED = "consentRejected",
}
