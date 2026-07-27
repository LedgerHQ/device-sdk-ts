import {
  type InternalApi,
  WaitForAppAndVersionDeviceAction,
} from "@ledgerhq/device-management-kit";

type WaitForAppAndVersionResult = ReturnType<
  WaitForAppAndVersionDeviceAction["makeStateMachine"]
>;

export const waitForAppAndVersion = (
  internalApi: InternalApi,
  unlockTimeout: number,
): WaitForAppAndVersionResult =>
  new WaitForAppAndVersionDeviceAction({
    input: { unlockTimeout },
  }).makeStateMachine(internalApi);
