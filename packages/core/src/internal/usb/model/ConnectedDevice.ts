import {
  DeviceId,
  DeviceModel,
} from "@internal/device-model/model/DeviceModel";

/**
 * Represents a connected device.
 */
export type ConnectedDevice = {
  id: DeviceId; // UUID to map with the associated transport device
  deviceModel: DeviceModel;
};
