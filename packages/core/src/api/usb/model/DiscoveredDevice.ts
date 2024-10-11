import { DeviceId, DeviceModel } from "@api/device/DeviceModel";

/**
 * A discovered device.
 */
export type DiscoveredDevice = {
  readonly id: DeviceId;
  readonly deviceModel: DeviceModel;
};
