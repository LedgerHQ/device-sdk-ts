import { DeviceModelId } from "@ledgerhq/device-management-kit";

export const DEFAULT_SCREENS = {
  [DeviceModelId.FLEX]: { width: 480, height: 600 },
  [DeviceModelId.STAX]: { width: 400, height: 672 },
} as const;

export type DefaultDeviceKey = keyof typeof DEFAULT_SCREENS & string;
