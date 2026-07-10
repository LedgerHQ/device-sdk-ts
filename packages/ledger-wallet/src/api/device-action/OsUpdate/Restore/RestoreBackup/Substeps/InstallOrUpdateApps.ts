import {
  type ApplicationDependency,
  InstallOrUpdateAppsDeviceAction,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

type InstallOrUpdateAppsResult = ReturnType<
  InstallOrUpdateAppsDeviceAction["makeStateMachine"]
>;

export const installOrUpdateApps = (
  internalApi: InternalApi,
  unlockTimeout: number,
  applications: ApplicationDependency[],
): InstallOrUpdateAppsResult =>
  new InstallOrUpdateAppsDeviceAction({
    input: { unlockTimeout, applications, allowMissingApplication: true },
  }).makeStateMachine(internalApi);
