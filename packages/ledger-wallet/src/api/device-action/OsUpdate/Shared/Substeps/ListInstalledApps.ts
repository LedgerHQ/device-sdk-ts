import {
  type InternalApi,
  ListInstalledAppsDeviceAction,
} from "@ledgerhq/device-management-kit";

type ListInstalledAppsResult = ReturnType<
  ListInstalledAppsDeviceAction["makeStateMachine"]
>;

export const listInstalledApps = (
  internalApi: InternalApi,
  unlockTimeout: number,
): ListInstalledAppsResult =>
  new ListInstalledAppsDeviceAction({
    input: { unlockTimeout },
  }).makeStateMachine(internalApi);
