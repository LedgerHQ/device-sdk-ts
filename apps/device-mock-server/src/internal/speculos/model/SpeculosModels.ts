/**
 * Well-known Speculos default test mnemonic. Used when no `SPECULOS_SEED` is
 * configured. Speculos derives all keys from this deterministic seed.
 */
export const DEFAULT_SPECULOS_SEED =
  "glory promote mansion idle axis finger extend february uncover one trip resolve toe";

/** Speculinho operator configuration. */
export interface SpeculosOperatorConfig {
  /** Operator base URL, e.g. `https://speculinho.ledgerlabs.net`. */
  readonly baseUrl: string;
  /** BIP39 mnemonic forwarded to Speculos on every acquire. */
  readonly seed: string;
  /** Optional speculos-apps image tag (defaults to operator's `latest`). */
  readonly speculosVersion?: string;
  /** Max acquire-to-ready wait before giving up. */
  readonly readyTimeoutMs?: number;
  /** Status poll cadence while waiting for readiness. */
  readonly pollIntervalMs?: number;
}

/** Parameters threaded into a Speculinho `/acquire` request body. */
export interface AcquireRequest {
  readonly coin_app: string;
  readonly coin_app_version: string;
  readonly device: string;
  readonly device_os_version: string;
}

/** Tagged error for any Speculinho/Speculos operation failure. */
export class SpeculosError {
  readonly _tag = "SpeculosError";
  constructor(readonly message: string) {}
}

/** A raw request to passthrough to a per-pod Speculos emulator. */
export interface SpeculosProxyRequest {
  readonly method: string;
  /** Path after the emulator base, e.g. `button/left`. */
  readonly path: string;
  /** Query string including the leading `?`, or "". */
  readonly query: string;
  readonly body: unknown;
  readonly hasBody: boolean;
}

/** The relayed emulator response. */
export interface SpeculosProxyResponse {
  readonly status: number;
  readonly contentType: string | null;
  readonly body: string;
}

/** Why opening an app via Speculos failed. */
export type OpenAppError =
  | { readonly _tag: "AppNotInstalled" }
  | { readonly _tag: "DeviceMisconfigured"; readonly reason: string }
  | { readonly _tag: "OperatorError"; readonly error: SpeculosError };
