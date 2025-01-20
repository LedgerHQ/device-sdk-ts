import { type DeviceId, type DeviceModel } from "@api/device/DeviceModel";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";

/**
 * A discovered device.
 */
export type DiscoveredDevice = {
  readonly id: DeviceId;
  readonly deviceModel: DeviceModel;
  readonly transport: TransportIdentifier;
  readonly name?: string;
  readonly rssi?: number | null;
};
