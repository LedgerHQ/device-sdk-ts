/**
 * Ledger's Manager API, called from the page rather than proxied through the
 * mock server: a read-only lookup with no session involved, and it answers
 * every origin with `access-control-allow-origin: *`.
 */
const MANAGER_API_URL = "https://manager.api.live.ledger.com/api";

const DEFAULT_PROVIDER = 1;

/** A release candidate is published to its model's own provider only. */
const providersFor = (rcProvider?: number): number[] =>
  rcProvider === undefined || rcProvider === DEFAULT_PROVIDER
    ? [DEFAULT_PROVIDER]
    : [DEFAULT_PROVIDER, rcProvider];

export interface CatalogApp {
  readonly name: string;
  readonly version: string;
  /** Install hash: what Ledger Live resolves an installed app by. */
  readonly hash?: string;
}

interface ApplicationDto {
  readonly versionName?: string;
  readonly version?: string;
  readonly hash?: string;
}

/**
 * The target id a device reports in GetOsVersion, derived from its model's
 * memory mask the way the mock server derives it. Every lookup here is keyed
 * on it.
 */
const targetIdForMask = (mask: number): number => (mask & 0xffff0000) | 0x0004;

const appsCache = new Map<string, CatalogApp[]>();

export class ManagerApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagerApiError";
  }
}

const get = async (path: string, params: Record<string, string>) => {
  const response = await fetch(
    `${MANAGER_API_URL}/${path}?${new URLSearchParams(params)}`,
  );
  return response;
};

/** The apps the catalogue lists for a model on a firmware. */
export async function listCatalogApps(
  mask: number,
  firmwareVersion: string,
  rcProvider?: number,
): Promise<CatalogApp[]> {
  const targetId = targetIdForMask(mask);
  const key = `${targetId}:${firmwareVersion}`;
  const cached = appsCache.get(key);
  if (cached) return cached;

  let entries: CatalogApp[] = [];
  for (const provider of providersFor(rcProvider)) {
    const response = await get("v2/apps/by-target", {
      target_id: String(targetId),
      provider: String(provider),
      firmware_version_name: firmwareVersion,
    });
    if (!response.ok) {
      throw new ManagerApiError(
        `The Manager API answered ${response.status} for the app list`,
      );
    }
    entries = toEntries((await response.json()) as ApplicationDto[]);
    if (entries.length > 0) break;
  }

  appsCache.set(key, entries);
  return entries;
}

function toEntries(apps: ApplicationDto[]): CatalogApp[] {
  const byName = new Map<string, CatalogApp>();
  for (const app of apps) {
    if (!app.versionName || !app.version) continue;
    if (!byName.has(app.versionName)) {
      byName.set(app.versionName, {
        name: app.versionName,
        version: app.version,
        hash: app.hash || undefined,
      });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
