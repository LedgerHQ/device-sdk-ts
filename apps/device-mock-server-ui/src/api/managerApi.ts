/**
 * Ledger's Manager API, called from the page rather than proxied through the
 * mock server: a read-only lookup with no session involved, and it answers
 * every origin with `access-control-allow-origin: *`.
 */
const MANAGER_API_URL = "https://manager.api.live.ledger.com/api";

const PROVIDER = "1";

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

interface DeviceVersionDto {
  readonly id?: number;
}

/**
 * The target id a device reports in GetOsVersion, derived from its model's
 * memory mask the way the mock server derives it. Every lookup here is keyed
 * on it.
 */
const targetIdForMask = (mask: number): number => (mask & 0xffff0000) | 0x0004;

const appsCache = new Map<string, CatalogApp[]>();
const deviceVersionCache = new Map<number, number>();
const firmwareCache = new Map<string, boolean>();

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
): Promise<CatalogApp[]> {
  const targetId = targetIdForMask(mask);
  const key = `${targetId}:${firmwareVersion}`;
  const cached = appsCache.get(key);
  if (cached) return cached;

  const response = await get("v2/apps/by-target", {
    target_id: String(targetId),
    provider: PROVIDER,
    firmware_version_name: firmwareVersion,
  });
  if (!response.ok) {
    throw new ManagerApiError(
      `The Manager API answered ${response.status} for the app list`,
    );
  }

  const apps = (await response.json()) as ApplicationDto[];
  const entries = toEntries(apps);
  appsCache.set(key, entries);
  return entries;
}

/**
 * Whether an OS version was ever released for a model. Asked because an
 * unreleased one returns an empty app list, which reads as "no apps" when the
 * answer is "no such OS".
 */
export async function firmwareExists(
  mask: number,
  firmwareVersion: string,
): Promise<boolean> {
  const targetId = targetIdForMask(mask);
  const key = `${targetId}:${firmwareVersion}`;
  const cached = firmwareCache.get(key);
  if (cached !== undefined) return cached;

  const deviceVersion = await resolveDeviceVersion(targetId);
  const response = await get("get_firmware_version", {
    device_version: String(deviceVersion),
    version_name: firmwareVersion,
    provider: PROVIDER,
  });
  // 404 is the answer "no such OS version", not a failure.
  if (!response.ok && response.status !== 404) {
    throw new ManagerApiError(
      `The Manager API answered ${response.status} for the OS version`,
    );
  }

  firmwareCache.set(key, response.ok);
  return response.ok;
}

async function resolveDeviceVersion(targetId: number): Promise<number> {
  const cached = deviceVersionCache.get(targetId);
  if (cached !== undefined) return cached;

  const response = await get("get_device_version", {
    target_id: String(targetId),
    provider: PROVIDER,
  });
  if (!response.ok) {
    throw new ManagerApiError("The Manager API does not know this model");
  }

  const { id } = (await response.json()) as DeviceVersionDto;
  if (id === undefined) {
    throw new ManagerApiError("The Manager API returned no device version");
  }
  deviceVersionCache.set(targetId, id);
  return id;
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
