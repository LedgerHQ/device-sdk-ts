import { type InternalApi } from "@ledgerhq/device-management-kit";

import { RestoreAppsStorageDeviceAction } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceAction";

type RestoreAppsStorageResult = ReturnType<
  RestoreAppsStorageDeviceAction["makeStateMachine"]
>;

export const restoreAppsStorage = (
  internalApi: InternalApi,
  unlockTimeout: number,
): RestoreAppsStorageResult =>
  new RestoreAppsStorageDeviceAction({
    input: { backupApps: [], isMasterConsentGranted: true, unlockTimeout },
  }).makeStateMachine(internalApi);
