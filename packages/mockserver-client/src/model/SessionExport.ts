import { array, Codec } from "purify-ts";

import { type DeviceConfig, deviceConfigCodec } from "./Device";

/**
 * A portable snapshot of a session's devices (and their mocks).
 *
 * Produced by `GET /export` and consumed by `POST /import` to save and restore
 * complex scenarios. Only configuration is captured (no ids, connection state
 * or response cursors), so importing recreates a fresh, deterministic session
 * state. Mocks are nested under each device (`DeviceConfig.mocks`).
 */
export interface SessionExport {
  readonly devices: DeviceConfig[];
}

export const sessionExportCodec = Codec.interface({
  devices: array(deviceConfigCodec),
});
