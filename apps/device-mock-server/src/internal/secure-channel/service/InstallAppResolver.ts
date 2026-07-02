import { type CatalogApp } from "@ledgerhq/device-mockserver-client";
import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { appTypes } from "@internal/di/types";
import { logger } from "@internal/logger/logger";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SessionRecord } from "@internal/session/model/SessionModels";

/** Production Manager API, used when no override is configured. */
const DEFAULT_MANAGER_API_URL = "https://manager.api.live.ledger.com/api";

/** Shape of the entries returned by the Manager API `/v2/apps/hash` endpoint. */
interface AppByHashDto {
  readonly versionName?: string;
  readonly version?: string;
}

/**
 * Resolves the app an install flow targets from the hash carried by the install
 * request — the way the real ScriptRunner backend knows apps by hash, so any app
 * installs without per-test seeding. A seeded session catalog wins (keeping unit
 * tests offline); otherwise the Manager API `/v2/apps/hash` endpoint is queried.
 */
@injectable()
export class InstallAppResolver {
  private readonly managerApiUrl: string;

  constructor(
    @inject(appTypes.Config) config: MockServerConfig,
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
  ) {
    this.managerApiUrl = config.managerApiUrl ?? DEFAULT_MANAGER_API_URL;
  }

  async resolve(
    record: SessionRecord,
    hash: string,
  ): Promise<Maybe<CatalogApp>> {
    const seeded = this.repository.findCatalogAppByHash(record, hash);
    if (seeded.isJust()) {
      return seeded;
    }
    return this.resolveFromManagerApi(hash);
  }

  private async resolveFromManagerApi(
    hash: string,
  ): Promise<Maybe<CatalogApp>> {
    try {
      const response = await fetch(`${this.managerApiUrl}/v2/apps/hash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([hash]),
      });
      if (!response.ok) {
        logger.warn(`Manager API /v2/apps/hash returned ${response.status}`);
        return Maybe.empty();
      }
      const apps = (await response.json()) as Array<AppByHashDto | null>;
      const app = apps?.[0];
      if (!app?.versionName) {
        logger.warn(`Manager API has no app for install hash ${hash}`);
        return Maybe.empty();
      }
      return Maybe.of({
        hash,
        name: app.versionName,
        version: app.version ?? "",
      });
    } catch (error) {
      logger.error(`Manager API hash lookup failed: ${String(error)}`);
      return Maybe.empty();
    }
  }
}
