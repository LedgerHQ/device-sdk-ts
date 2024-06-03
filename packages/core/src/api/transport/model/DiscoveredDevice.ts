import { DeviceId, DeviceModel } from "@api/device/DeviceModel";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";

/**
 * A discovered device.
 */
export type DiscoveredDevice = {
  readonly id: DeviceId;
  readonly deviceModel: DeviceModel;
  readonly transport: TransportIdentifier;
};
