import { type Device, type Mock } from "@ledgerhq/device-mockserver-client";

/**
 * A device that has opened an app and is now proxying its APDUs to a live
 * Speculos instance managed by the Speculinho operator.
 */
export interface SpeculosProxySession {
  /** Speculinho `run_id` owning the Speculos pod. */
  readonly runId: string;
  /** Per-pod Speculos base URL handed back by Speculinho. */
  readonly speculosUrl: string;
  /** BOLOS app name that opened the proxy. */
  readonly appName: string;
}

/** A bearer-token session and everything it owns. */
export interface SessionRecord {
  id: string;
  token: string;
  createdAt: number;
  lastSeenAt: number;
  devices: Map<string, Device>;
  /** Per-device mock table: deviceId -> (mockId -> Mock). */
  deviceMocks: Map<string, Map<string, Mock>>;
  /** Per-device response cursors: deviceId -> (mockId -> next index). */
  deviceMockCursors: Map<string, Map<string, number>>;
  /** Active Speculos proxy per device id. */
  speculos: Map<string, SpeculosProxySession>;
}
