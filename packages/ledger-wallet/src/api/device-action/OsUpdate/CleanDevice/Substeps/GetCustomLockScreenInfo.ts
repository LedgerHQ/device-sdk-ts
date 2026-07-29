import { type InternalApi } from "@ledgerhq/device-management-kit";

import { GetCustomLockScreenInfoDeviceAction } from "@api/device-action/GetCustomLockScreenInfo/GetCustomLockScreenInfoDeviceAction";

type GetCustomLockScreenInfoResult = ReturnType<
  GetCustomLockScreenInfoDeviceAction["makeStateMachine"]
>;

export const getCustomLockScreenInfo = (
  internalApi: InternalApi,
  unlockTimeout: number,
): GetCustomLockScreenInfoResult =>
  new GetCustomLockScreenInfoDeviceAction({
    input: { unlockTimeout },
  }).makeStateMachine(internalApi);
