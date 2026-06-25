import { type Server } from "node:http";

import { type Express } from "express";

import { type SpeculosOperatorConfig } from "@internal/speculos/model/SpeculosModels";

/** Public configuration for {@link createMockServer}. */
export interface MockServerConfig {
  /** Sliding inactivity timeout in ms (refreshed on every authed request). */
  readonly ttlMs?: number;
  /** Hard cap on a session lifetime in ms, regardless of activity. */
  readonly maxLifetimeMs?: number;
  /** Interval in ms for the expired-session sweeper. Set to 0 to disable. */
  readonly sweepIntervalMs?: number;
  /**
   * Speculinho operator configuration. When set, an unmatched Open App APDU
   * starts a real Speculos instance and the device proxies APDUs to it. When
   * omitted, the server behaves as a pure mock.
   */
  readonly speculos?: SpeculosOperatorConfig;
}

/** A built mock server: the Express app plus a lifecycle handle. */
export interface MockServerApp {
  readonly app: Express;
  /** Stop the background sweeper. */
  readonly close: () => void;
  /**
   * Attach the mock ScriptRunner secure-channel WebSocket server to the running
   * HTTP server (the one returned by `app.listen`). Call once after listening.
   */
  readonly attachWebSocket: (server: Server) => void;
}
