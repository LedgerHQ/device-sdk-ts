import { array, Codec, number, optional, string } from "purify-ts";

import { deviceAppCodec, type DeviceConfig } from "./Device";
import { type MockConfig } from "./Mock";

/**
 * A portable snapshot of a session's devices and mocks.
 *
 * Produced by `GET /export` and consumed by `POST /import` to save and restore
 * complex scenarios. Only configuration is captured (no ids, connection state
 * or response cursors), so importing recreates a fresh, deterministic session
 * state.
 */
export interface SessionExport {
  readonly devices: DeviceConfig[];
  readonly mocks: MockConfig[];
}

const deviceConfigCodec = Codec.interface({
  name: optional(string),
  device_type: optional(string),
  connectivity_type: optional(string),
  firmware_version: optional(string),
  apps: optional(array(deviceAppCodec)),
  masks: optional(array(number)),
});

const mockConfigCodec = Codec.interface({
  prefix: string,
  response: optional(string),
  responses: optional(array(string)),
});

export const sessionExportCodec = Codec.interface({
  devices: array(deviceConfigCodec),
  mocks: array(mockConfigCodec),
});
