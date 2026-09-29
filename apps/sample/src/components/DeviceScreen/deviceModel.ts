/**
 * src/components/DeviceScreen/deviceModel.ts
 *
 * The icon the device screen header shows for each model.
 */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Icons } from "@ledgerhq/react-ui";

export const DEVICE_SCREEN_ICON: Record<DeviceModelId, typeof Icons.Nano> = {
  [DeviceModelId.NANO_S]: Icons.Nano,
  [DeviceModelId.NANO_SP]: Icons.Nano,
  [DeviceModelId.NANO_X]: Icons.Nano,
  [DeviceModelId.STAX]: Icons.Stax,
  [DeviceModelId.FLEX]: Icons.Flex,
  [DeviceModelId.APEX]: Icons.Apex,
};
