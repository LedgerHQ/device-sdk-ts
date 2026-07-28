import { type InternalApi } from "@ledgerhq/device-management-kit";

import { RemoveCustomLockScreenDeviceAction } from "@api/device-action/RemoveCustomLockScreen/RemoveCustomLockScreenDeviceAction";

type RemoveCustomLockScreenResult = ReturnType<
  RemoveCustomLockScreenDeviceAction["makeStateMachine"]
>;

export const removeCustomLockScreen = (
  internalApi: InternalApi,
  unlockTimeout: number,
): RemoveCustomLockScreenResult =>
  new RemoveCustomLockScreenDeviceAction({
    input: { unlockTimeout },
  }).makeStateMachine(internalApi);
