import {
  DeviceId,
  DeviceModel,
} from "@internal/device-model/model/DeviceModel";

/**
 * Represents a discovered/scanned (not yet connected to) device.
 */
export type DiscoveredDevice = {
  // type: "web-hid", // "node-hid" in the future -> no need as we will only have 1 USB transport implementation running
  id: DeviceId; // UUID to map with the associated transport device
  deviceModel: DeviceModel;
};
