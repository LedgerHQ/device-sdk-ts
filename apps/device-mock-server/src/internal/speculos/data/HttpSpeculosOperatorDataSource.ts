import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { logger } from "@internal/logger/logger";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import {
  type AcquireRequest,
  SpeculosError,
  type SpeculosOperatorConfig,
  type SpeculosProxyRequest,
  type SpeculosProxyResponse,
} from "@internal/speculos/model/SpeculosModels";

const DEFAULT_READY_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, "");

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface StatusResponse {
  readonly run_id: string;
  readonly status: "pending" | "ready" | "failed";
  readonly speculos_url?: string;
  readonly error_details?: string;
}

const safeText = async (res: Response): Promise<string> => {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
};

/**
 * `fetch`-based {@link SpeculosOperatorDataSource} (requires Node 18+). See
 * https://ledgerhq.atlassian.net/wiki/spaces/PE/pages/7100399635.
 */
@injectable()
export class HttpSpeculosOperatorDataSource
  implements SpeculosOperatorDataSource
{
  private readonly baseUrl: string;
  private readonly speculosVersion?: string;
  private readonly readyTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(
    @inject(speculosTypes.OperatorConfig) config: SpeculosOperatorConfig,
  ) {
    this.baseUrl = stripTrailingSlashes(config.baseUrl);
    this.speculosVersion = config.speculosVersion;
    this.readyTimeoutMs = config.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  acquire(
    req: AcquireRequest,
    runId: string,
    seed: string,
  ): EitherAsync<SpeculosError, string> {
    return EitherAsync(async ({ throwE }) => {
      const body: Record<string, unknown> = {
        ...req,
        seed,
        run_id: runId,
      };
      if (this.speculosVersion) body["speculos_version"] = this.speculosVersion;
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/acquire`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (error) {
        return throwE(
          new SpeculosError(`acquire request failed: ${String(error)}`),
        );
      }
      if (!res.ok) {
        return throwE(
          new SpeculosError(
            `acquire failed (${res.status}): ${await safeText(res)}`,
          ),
        );
      }
      return runId;
    });
  }

  waitUntilReady(runId: string): EitherAsync<SpeculosError, string> {
    return EitherAsync(async ({ throwE }) => {
      const deadline = Date.now() + this.readyTimeoutMs;
      for (;;) {
        let status: StatusResponse;
        try {
          const res = await fetch(`${this.baseUrl}/status/${runId}`);
          if (!res.ok) {
            return throwE(
              new SpeculosError(
                `status failed (${res.status}): ${await safeText(res)}`,
              ),
            );
          }
          status = (await res.json()) as StatusResponse;
        } catch (error) {
          return throwE(
            new SpeculosError(`status request failed: ${String(error)}`),
          );
        }
        if (status.status === "ready" && status.speculos_url) {
          return status.speculos_url;
        }
        if (status.status === "failed") {
          return throwE(
            new SpeculosError(
              `speculos run ${runId} failed: ${status.error_details ?? "unknown"}`,
            ),
          );
        }
        if (Date.now() >= deadline) {
          return throwE(
            new SpeculosError(`speculos run ${runId} not ready within timeout`),
          );
        }
        await sleep(this.pollIntervalMs);
      }
    });
  }

  release(runId: string): EitherAsync<SpeculosError, void> {
    // Best-effort: failures are logged, never surfaced as Left.
    return EitherAsync(async () => {
      try {
        await fetch(`${this.baseUrl}/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: runId }),
        });
      } catch (error) {
        logger.warn(
          `Failed to release speculos run ${runId}: ${String(error)}`,
        );
      }
    });
  }

  forwardApdu(
    speculosUrl: string,
    apduHex: string,
  ): EitherAsync<SpeculosError, string> {
    return EitherAsync(async ({ throwE }) => {
      let res: Response;
      try {
        res = await fetch(`${stripTrailingSlashes(speculosUrl)}/apdu`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: apduHex }),
        });
      } catch (error) {
        return throwE(
          new SpeculosError(`apdu forward request failed: ${String(error)}`),
        );
      }
      if (!res.ok) {
        return throwE(
          new SpeculosError(
            `apdu forward failed (${res.status}): ${await safeText(res)}`,
          ),
        );
      }
      const json = (await res.json()) as { data?: string };
      if (typeof json.data !== "string") {
        return throwE(new SpeculosError("apdu forward returned no data"));
      }
      return json.data;
    });
  }

  proxyRequest(
    speculosUrl: string,
    request: SpeculosProxyRequest,
  ): EitherAsync<SpeculosError, SpeculosProxyResponse> {
    return EitherAsync(async ({ throwE }) => {
      const base = stripTrailingSlashes(speculosUrl);
      const url = `${base}/${request.path}${request.query}`;
      try {
        const upstream = await fetch(url, {
          method: request.method,
          headers: request.hasBody
            ? { "Content-Type": "application/json" }
            : undefined,
          body: request.hasBody
            ? JSON.stringify(request.body ?? {})
            : undefined,
        });
        return {
          status: upstream.status,
          contentType: upstream.headers.get("content-type"),
          body: await upstream.text(),
        };
      } catch (error) {
        return throwE(
          new SpeculosError(`speculos proxy request failed: ${String(error)}`),
        );
      }
    });
  }
}
