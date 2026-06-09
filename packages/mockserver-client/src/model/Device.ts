import { array, boolean, Codec, number, optional, string } from "purify-ts";

export type DeviceConnectivityType = "USB" | "BLE";

export interface DeviceApp {
  readonly name: string;
  readonly version: string;
}

export const deviceAppCodec = Codec.interface({
  name: string,
  version: string,
});

/**
 * A mocked device attached to a session.
 *
 * Following ADR 002 (Solution 3), the device exposes rich metadata (firmware
 * version, installed applications, memory masks) so DMK can build a realistic
 * device session.
 */
export interface Device {
  readonly id: string;
  readonly name: string;
  /** DeviceModelId enum value, e.g. "nanoX", "stax", "flex". */
  readonly device_type: string;
  readonly connectivity_type: string;
  readonly firmware_version?: string;
  readonly apps?: DeviceApp[];
  readonly masks?: number[];
  readonly connected?: boolean;
}

export const deviceCodec = Codec.interface({
  id: string,
  name: string,
  device_type: string,
  connectivity_type: string,
  firmware_version: optional(string),
  apps: optional(array(deviceAppCodec)),
  masks: optional(array(number)),
  connected: optional(boolean),
});

/**
 * Payload used to attach (POST /devices) or edit (PATCH /devices/:id) a device.
 */
export interface DeviceConfig {
  readonly name?: string;
  readonly device_type?: string;
  readonly connectivity_type?: string;
  readonly firmware_version?: string;
  readonly apps?: DeviceApp[];
  readonly masks?: number[];
}
