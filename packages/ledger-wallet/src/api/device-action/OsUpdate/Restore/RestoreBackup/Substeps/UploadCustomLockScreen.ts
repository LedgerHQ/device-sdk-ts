import { type InternalApi } from "@ledgerhq/device-management-kit";

import { UploadCustomLockScreenDeviceAction } from "@api/device-action/UploadCustomLockScreen/UploadCustomLockScreenDeviceAction";

type UploadCustomLockScreenResult = ReturnType<
  UploadCustomLockScreenDeviceAction["makeStateMachine"]
>;

export const uploadCustomLockScreenDevice = (
  internalApi: InternalApi,
  unlockTimeout: number,
  imageData: Uint8Array,
): UploadCustomLockScreenResult =>
  new UploadCustomLockScreenDeviceAction({
    input: { unlockTimeout, imageData },
  }).makeStateMachine(internalApi);
