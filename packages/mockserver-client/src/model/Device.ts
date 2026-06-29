import { array, boolean, Codec, number, optional, string } from "purify-ts";

import { type MockConfig, mockConfigCodec } from "./Mock";

export type DeviceConnectivityType = "USB" | "BLE";

export interface DeviceApp {
  readonly name: string;
  readonly version: string;
  readonly hash?: string;
}

export const deviceAppCodec = Codec.interface({
  name: string,
  version: string,
  hash: optional(string),
});

/**
 * An installable app known to the mock "app store", keyed by its install
 * `hash`. The secure-channel install flow resolves the hash sent by DMK to one
 * of these entries to learn which app is being installed.
 */
export interface CatalogApp {
  readonly hash: string;
  readonly name: string;
  readonly version: string;
}

export const catalogAppCodec = Codec.interface({
  hash: string,
  name: string,
  version: string,
});

/**
 * A mocked device attached to a session.
 *
 * The device exposes rich metadata (firmware
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
  /** Device-scoped APDU mocks, used when attaching (POST) or importing a device. */
  readonly mocks?: MockConfig[];
  /** Installable apps the mock "app store" can resolve from an install hash. */
  readonly catalog?: CatalogApp[];
}

export const deviceConfigCodec = Codec.interface({
  name: optional(string),
  device_type: optional(string),
  connectivity_type: optional(string),
  firmware_version: optional(string),
  apps: optional(array(deviceAppCodec)),
  masks: optional(array(number)),
  mocks: optional(array(mockConfigCodec)),
  catalog: optional(array(catalogAppCodec)),
});
