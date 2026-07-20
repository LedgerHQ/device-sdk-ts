import {
  type CatalogApp,
  type Device,
  type Mock,
} from "@ledgerhq/device-mockserver-client";

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
  /**
   * BIP39 mnemonic forwarded to Speculos on every acquire for this session.
   * Defaults to the well-known test mnemonic; overridable via PUT
   * /sessions/current/seed.
   *
   * WARNING: stored in plaintext in memory and transmitted in plaintext HTTP.
   * Use only test mnemonics — never real production keys.
   */
  seed: string;
  devices: Map<string, Device>;
  /** Per-device mock table: deviceId -> (mockId -> Mock). */
  deviceMocks: Map<string, Map<string, Mock>>;
  /** Per-device response cursors: deviceId -> (mockId -> next index). */
  deviceMockCursors: Map<string, Map<string, number>>;
  /** Active Speculos proxy per device id. */
  speculos: Map<string, SpeculosProxySession>;
  /** Installable apps known to the mock "app store", keyed by install hash. */
  catalog: Map<string, CatalogApp>;
  /**
   * App targeted by an in-flight secure-channel install/uninstall, awaiting
   * commit when the final install block is acknowledged: deviceId -> app.
   */
  pendingAppOperations: Map<string, CatalogApp>;
  /**
   * Target `firmware_version` of an in-flight secure-channel firmware install
   * (OSU or final), awaiting commit when the final install block is
   * acknowledged: deviceId -> version. Set to `<next>-osu` for the OSU install
   * and to the clean `<next>` for the final install.
   */
  pendingFirmwareOperations: Map<string, string>;
}
