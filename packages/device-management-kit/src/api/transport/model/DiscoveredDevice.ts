import { type DeviceId, type DeviceModel } from "@api/device/DeviceModel";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";

/**
 * A discovered device.
 */
export type DiscoveredDevice = {
  readonly id: DeviceId;
  readonly name: string;
  readonly deviceModel: DeviceModel;
  readonly transport: TransportIdentifier;
  readonly rssi?: number | null;
};
