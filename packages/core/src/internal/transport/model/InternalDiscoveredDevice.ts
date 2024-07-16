import { DeviceId } from "@api/device/DeviceModel";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";

/**
 * A discovered / scanned (not yet connected to) device.
 */
export type InternalDiscoveredDevice = {
  // type: "web-hid", // "node-hid" in the future -> no need as we will only have 1 USB transport implementation running

  /**
   * Unique identifier for the device.
   * NB: This identifier is generated at runtime and is not persisted.
   * It cannot be used to identify a device across sessions.
   * There is in fact no way to identify a device across sessions, which is a
   * privacy feature of Ledger devices.
   */
  id: DeviceId;
  deviceModel: InternalDeviceModel;
  transport: TransportIdentifier;
};
