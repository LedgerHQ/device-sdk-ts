import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { randomUUID } from "crypto";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalConfig } from "@root/src/domain/models/config/CalConfig";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

const DEFAULT_READY_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const ROUTE_TIMEOUT_SECONDS = 60;

/** Speculos' own default seed, so a pod derives the same keys it would with no
 * `--seed` at all. Overridable via SPECULOS_SEED env var. */
const DEFAULT_SPECULOS_SEED =
  "glory promote mansion idle axis finger extra february uncover one trip resource lawn turtle enact monster seven myth punch hobby comfort wild raise skin";

/**
 * Address Book proofs are device-bound: the device mints them with its user and
 * attestation keys, which Speculos generates afresh on every boot unless they are
 * pinned. Each run gets a new pod, so without this a recorded address book is
 * rejected with `6982` ("registered with a different seed") by the next pod.
 *
 * Emulator test values only - never a real device secret.
 */
const DEVICE_USER_PRIVATE_KEY =
  "0101010101010101010101010101010101010101010101010101010101010101";
const DEVICE_ATTESTATION_KEY =
  "0202020202020202020202020202020202020202020202020202020202020202";
const DETERMINISTIC_RNG_SEED = "cs-tester";

interface StatusResponse {
  readonly run_id: string;
  readonly status: "pending" | "ready" | "failed";
  readonly speculos_url?: string;
  readonly error_details?: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, "");

/**
 * ServiceController that provisions a Speculos pod via the Speculinho operator
 * (https://ledgerhq.atlassian.net/wiki/spaces/PE/pages/7100399635).
 *
 * On start():
 *  1. POSTs /acquire to request a pod with the configured coin app and device.
 *  2. Polls /status/:runId until the pod is "ready".
 *  3. Writes the returned `speculos_url` back into `SpeculinhoConfig.resolvedUrl`
 *     so all downstream adapters (screen reader, DMK transport, …) pick it up.
 *
 * On stop():
 *  - POSTs /release to return the pod.
 *
 * No local Docker, COIN_APPS_PATH, or app binary management is required.
 */
@injectable()
export class SpeculinhoServiceController implements ServiceController {
  private readonly logger: LoggerPublisherService;
  private readonly baseUrl: string;
  private runId: string | null = null;

  constructor(
    @inject(TYPES.SpeculinhoConfig)
    private readonly config: SpeculinhoConfig,
    @inject(TYPES.CalConfig)
    private readonly calConfig: CalConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("speculinho-service-controller");
    const url =
      config.speculinhoUrl ??
      process.env["SPECULINHO_URL"] ??
      "https://speculinho.ledgerlabs.net";
    this.baseUrl = stripTrailingSlashes(url);
  }

  async start(): Promise<void> {
    const appName = this.config.appName ?? "Ethereum";
    const appVersion = this.config.appVersion;
    const osVersion = this.config.osVersion;

    this.runId = `cs-tester-${randomUUID()}`;

    this.logger.info(
      `Acquiring Speculinho pod (runId=${this.runId}, app=${appName}${appVersion ? `@${appVersion}` : ""}, device=${this.config.device}${osVersion ? `, os=${osVersion}` : ""})`,
    );

    await this.acquire(appName, appVersion, osVersion);
    const speculosUrl = await this.waitUntilReady();

    this.config.resolvedUrl = speculosUrl;
    this.logger.info(`Speculinho pod ready at ${speculosUrl}`);
  }

  async stop(): Promise<void> {
    if (!this.runId) return;

    this.logger.info(`Releasing Speculinho pod (runId=${this.runId})`);
    try {
      await fetch(`${this.baseUrl}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: this.runId }),
      });
    } catch (error) {
      this.logger.warn(`Failed to release Speculinho pod: ${String(error)}`);
    } finally {
      this.runId = null;
      this.config.resolvedUrl = undefined;
    }
  }

  private async acquire(
    appName: string,
    appVersion: string | undefined,
    osVersion: string | undefined,
  ): Promise<void> {
    const seed = process.env["SPECULOS_SEED"] ?? DEFAULT_SPECULOS_SEED;

    const body: Record<string, unknown> = {
      coin_app: appName,
      coin_app_version: appVersion,
      device: this.config.device,
      device_os_version: osVersion,
      seed,
      run_id: this.runId,
      route_timeout_seconds: ROUTE_TIMEOUT_SECONDS,
    };

    // Forwarded verbatim to the pod's Speculos via Speculinho `extra_args`.
    const extraArgs = [
      // Pin the device identity so Address Book proofs survive a new pod.
      "--user-private-key",
      DEVICE_USER_PRIVATE_KEY,
      "--attestation-key",
      DEVICE_ATTESTATION_KEY,
      "--deterministic-rng",
      DETERMINISTIC_RNG_SEED,
    ];

    // "-p" makes Speculos trust the production PKI root when CAL mode is "prod".
    // Without it Speculos defaults to the test root and prod-signed CAL
    // certificates (PKI + gated descriptors) fail on-device with 5720 "failed to
    // verify signature". Mirrors the local Docker path in SpeculosServiceController.
    if (this.calConfig.mode === "prod") {
      extraArgs.push("-p");
    }

    body["extra_args"] = extraArgs;

    this.logger.debug("Acquiring Speculinho pod", {
      data: { body },
    });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/acquire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(`Speculinho acquire request failed: ${String(error)}`);
    }

    if (!res.ok) {
      throw new Error(
        `Speculinho acquire failed (${res.status}): ${await res.text()}`,
      );
    }
  }

  private async waitUntilReady(): Promise<string> {
    const deadline = Date.now() + DEFAULT_READY_TIMEOUT_MS;

    for (;;) {
      let status: StatusResponse;
      try {
        const res = await fetch(`${this.baseUrl}/status/${this.runId}`);
        if (!res.ok) {
          throw new Error(
            `Speculinho status failed (${res.status}): ${await res.text()}`,
          );
        }
        status = (await res.json()) as StatusResponse;
      } catch (error) {
        throw new Error(`Speculinho status request failed: ${String(error)}`);
      }

      if (status.status === "ready" && status.speculos_url) {
        return status.speculos_url;
      }

      if (status.status === "failed") {
        throw new Error(
          `Speculinho pod ${this.runId} failed: ${status.error_details ?? "unknown"}`,
        );
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Speculinho pod ${this.runId} not ready within ${DEFAULT_READY_TIMEOUT_MS / 1000}s`,
        );
      }

      this.logger.debug(
        `Waiting for Speculinho pod to be ready (status=${status.status})…`,
      );
      await sleep(DEFAULT_POLL_INTERVAL_MS);
    }
  }
}
