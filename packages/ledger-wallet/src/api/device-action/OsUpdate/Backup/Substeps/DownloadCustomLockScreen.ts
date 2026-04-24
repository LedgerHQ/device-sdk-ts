import { type InternalApi } from "@ledgerhq/device-management-kit";

import { DownloadCustomLockScreenDeviceAction } from "@api/device-action/DownloadCustomLockScreen/DownloadCustomLockScreenDeviceAction";

type DownloadCustomLockScreenResult = ReturnType<
  DownloadCustomLockScreenDeviceAction["makeStateMachine"]
>;

export const downloadCustomLockScreenDevice = (
  internalAPI: InternalApi,
  unlockTimeout: number,
  allowedEmpty: boolean,
): DownloadCustomLockScreenResult =>
  new DownloadCustomLockScreenDeviceAction({
    input: { unlockTimeout, allowedEmpty },
  }).makeStateMachine(internalAPI);
