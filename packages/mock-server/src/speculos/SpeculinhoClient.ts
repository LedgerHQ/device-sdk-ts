import { logger } from "../logger";

/**
 * Well-known Speculos default test mnemonic. Used when no `SPECULOS_SEED` is
 * configured. Speculos derives all keys from this deterministic seed.
 */
export const DEFAULT_SPECULOS_SEED =
  "glory promote mansion idle axis finger extend february uncover one trip resolve toe";

const DEFAULT_READY_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

/** Parameters threaded into a Speculinho `/acquire` request body. */
export interface AcquireRequest {
  readonly coin_app: string;
  readonly coin_app_version: string;
  readonly device: string;
  readonly device_os_version: string;
}

export interface SpeculinhoClientOptions {
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

interface StatusResponse {
  readonly run_id: string;
  readonly status: "pending" | "ready" | "failed";
  readonly speculos_url?: string;
  readonly error_details?: string;
}

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, "");

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Thin client for the Speculinho operator HTTP API (see
 * https://ledgerhq.atlassian.net/wiki/spaces/PE/pages/7100399635). Uses the
 * global `fetch`, so requires Node 18+.
 */
export class SpeculinhoClient {
  private readonly baseUrl: string;
  private readonly seed: string;
  private readonly speculosVersion?: string;
  private readonly readyTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: SpeculinhoClientOptions) {
    this.baseUrl = stripTrailingSlashes(options.baseUrl);
    this.seed = options.seed;
    this.speculosVersion = options.speculosVersion;
    this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  /** Create a Speculos instance. Returns the (echoed) `run_id`. */
  async acquire(req: AcquireRequest, runId: string): Promise<string> {
    const body: Record<string, unknown> = {
      ...req,
      seed: this.seed,
      run_id: runId,
    };
    if (this.speculosVersion) body["speculos_version"] = this.speculosVersion;

    const res = await fetch(`${this.baseUrl}/acquire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`acquire failed (${res.status}): ${await safeText(res)}`);
    }
    return runId;
  }

  /**
   * Poll `/status/{run_id}` until the instance is `ready` (resolving its
   * `speculos_url`), or throw on `failed` / timeout.
   */
  async waitUntilReady(runId: string): Promise<string> {
    const deadline = Date.now() + this.readyTimeoutMs;
    for (;;) {
      const status = await this.status(runId);
      if (status.status === "ready" && status.speculos_url) {
        return status.speculos_url;
      }
      if (status.status === "failed") {
        throw new Error(
          `speculos run ${runId} failed: ${status.error_details ?? "unknown"}`,
        );
      }
      if (Date.now() >= deadline) {
        throw new Error(`speculos run ${runId} not ready within timeout`);
      }
      await sleep(this.pollIntervalMs);
    }
  }

  /** Destroy a Speculos instance. Best-effort: failures are logged, not thrown. */
  async release(runId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId }),
      });
    } catch (error) {
      logger.warn(`Failed to release speculos run ${runId}: ${String(error)}`);
    }
  }

  /** Forward a raw APDU (hex) to a ready Speculos pod, returning its hex response. */
  async forwardApdu(speculosUrl: string, apduHex: string): Promise<string> {
    const res = await fetch(`${stripTrailingSlashes(speculosUrl)}/apdu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: apduHex }),
    });
    if (!res.ok) {
      throw new Error(
        `apdu forward failed (${res.status}): ${await safeText(res)}`,
      );
    }
    const json = (await res.json()) as { data?: string };
    if (typeof json.data !== "string") {
      throw new Error("apdu forward returned no data");
    }
    return json.data;
  }

  private async status(runId: string): Promise<StatusResponse> {
    const res = await fetch(`${this.baseUrl}/status/${runId}`);
    if (!res.ok) {
      throw new Error(`status failed (${res.status}): ${await safeText(res)}`);
    }
    return (await res.json()) as StatusResponse;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
