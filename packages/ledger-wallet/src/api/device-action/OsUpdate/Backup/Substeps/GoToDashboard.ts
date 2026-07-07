import {
  GoToDashboardDeviceAction,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

type GoToDashboardResult = ReturnType<
  GoToDashboardDeviceAction["makeStateMachine"]
>;

export const goToDashboard = (
  internalApi: InternalApi,
  unlockTimeout: number,
): GoToDashboardResult =>
  new GoToDashboardDeviceAction({
    input: { unlockTimeout },
  }).makeStateMachine(internalApi);
