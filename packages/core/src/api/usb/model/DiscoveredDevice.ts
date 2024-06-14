import { DeviceId, DeviceModel } from "@api/device/DeviceModel";

/**
 * A discovered device.
 */
export type DiscoveredDevice = {
  id: DeviceId;
  deviceModel: DeviceModel;
};
