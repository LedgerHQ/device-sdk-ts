import { DeviceId, DeviceModel } from "@api/device/DeviceModel";
import { BuiltinTransport } from "@api/transport/model/BuiltinTransport";

/**
 * A discovered device.
 */
export type DiscoveredDevice = {
  readonly id: DeviceId;
  readonly deviceModel: DeviceModel;
  readonly transport: BuiltinTransport;
};
