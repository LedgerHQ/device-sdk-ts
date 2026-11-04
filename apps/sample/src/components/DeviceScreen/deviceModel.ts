/**
 * src/components/DeviceScreen/deviceModel.ts
 *
 * The icon the device screen header shows for each model.
 */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Flex, Nano, Stax } from "@ledgerhq/lumen-ui-react/symbols";

// Lumen has no Apex icon, so that model falls back to the Flex one.
export const DEVICE_SCREEN_ICON: Record<DeviceModelId, typeof Nano> = {
  [DeviceModelId.NANO_S]: Nano,
  [DeviceModelId.NANO_SP]: Nano,
  [DeviceModelId.NANO_X]: Nano,
  [DeviceModelId.STAX]: Stax,
  [DeviceModelId.FLEX]: Flex,
  [DeviceModelId.APEX]: Flex,
};
