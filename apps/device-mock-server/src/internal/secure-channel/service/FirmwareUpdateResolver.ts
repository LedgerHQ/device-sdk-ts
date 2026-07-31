import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { appTypes } from "@internal/di/types";
import { logger } from "@internal/logger/logger";

/** Production Manager API, used when no override is configured. */
const DEFAULT_MANAGER_API_URL = "https://manager.api.live.ledger.com/api";

/** Manager API version tag echoed on every request (value is not significant). */
const LIVE_COMMON_VERSION = "36.2.0";

/**
 * Default provider (1 = Ledger). Mirrors `FORCE_PROVIDER`'s default in
 * ledger-live; the mock does not model alternative firmware providers.
 */
const DEFAULT_PROVIDER = 1;

/**
 * Rollout salt the Manager API uses to gate staged firmware releases. In
 * production it is derived from the user id; the mock sends a fixed value, so
 * fully-rolled-out firmwares always resolve while a staged-rollout target may
 * return no update (in which case the OSU install fails fast).
 */
const ROLLOUT_SALT = "00000000";

interface DeviceVersionDto {
  readonly id?: number;
}

interface FinalFirmwareDto {
  readonly id?: number;
  readonly name?: string;
  /** Ids of the MCU versions this firmware is compatible with. */
  readonly mcu_versions?: number[];
}

interface OsuFirmwareDto {
  readonly name?: string;
  readonly next_se_firmware_final_version?: number;
}

interface LatestFirmwareDto {
  readonly result?: string;
  readonly se_firmware_osu_version?: OsuFirmwareDto;
}

interface McuVersionDto {
  readonly id?: number;
  readonly name?: string;
}

/**
 * Resolves firmware-update facts from the Manager API the way the real
 * ScriptRunner backend does: the clean version a firmware install targets
 * ({@link resolveNextVersion}) and the current MCU version to advertise so the
 * update takes the no-MCU-flash path ({@link resolveCurrentMcuVersion}). Both
 * replicate `getLatestFirmwareForDevice` (the non-OSU branch), mirroring
 * {@link InstallAppResolver}'s lookup so firmware updates work without
 * per-test seeding.
 */
@injectable()
export class FirmwareUpdateResolver {
  private readonly managerApiUrl: string;

  /**
   * Memoized final-firmware lookups keyed by `${targetId}:${currentVersion}:
   * ${providerId}`. Shared by both public callers so the 4-call Manager API chain
   * runs at most once per device/version pair per server lifetime.
   */
  private readonly finalFirmwareCache = new Map<
    string,
    Promise<Maybe<FinalFirmwareDto>>
  >();

  /**
   * Memoized MCU-version lookups keyed by `${targetId}:${currentVersion}:
   * ${providerId}`. GetOsVersion is replayed on every connect/poll, so caching
   * the (deterministic) Manager API result keeps the handshake off the network
   * after the first resolution. Deterministic negatives (unknown target, no
   * update) are cached too; transient failures (network error, 5xx) are evicted
   * so the next poll retries instead of caching the error permanently.
   */
  private readonly mcuVersionCache = new Map<string, Promise<Maybe<string>>>();

  constructor(@inject(appTypes.Config) config: MockServerConfig) {
    this.managerApiUrl = config.managerApiUrl ?? DEFAULT_MANAGER_API_URL;
  }

  /**
   * Resolve the clean (non-OSU) version a device on `currentVersion` would
   * update to, e.g. `1.10.1`. Desktop's update runs a single OSU install and
   * then just polls `getDeviceInfo`; a real device auto-flashes the final image
   * on reboot, so the mock commits straight to this clean target (no `-osu`
   * intermediate, which would strand the device — nothing drops the suffix).
   * Returns `Nothing` when the Manager API reports no update or a lookup fails.
   */
  async resolveNextVersion(params: {
    targetId: string | number;
    currentVersion: string;
    providerId?: number;
  }): Promise<Maybe<string>> {
    return (await this.resolveFinalFirmware(params)).chain((final) =>
      Maybe.fromNullable(final.name),
    );
  }

  /**
   * Resolve the MCU version name (e.g. `5.32.3`) to report as the device's
   * *current* MCU in GetOsVersion, so Ledger Live's firmware-update flow takes
   * the no-MCU-flash path. LLD computes
   * `shouldFlashMCU = !finalFirmware.mcu_versions.includes(<id of the MCU named
   * mcuSephVersion>)`; picking a name from the target firmware's `mcu_versions`
   * (matched to the `/mcu_versions` catalog, which LLD also consults and would
   * otherwise reject as an unknown MCU) guarantees `shouldFlashMCU` is false.
   * Returns `Nothing` when there is no update or a lookup fails; callers can then
   * choose whether to synthesize GetOsVersion or let the APDU fall through.
   */
  async resolveCurrentMcuVersion({
    targetId,
    currentVersion,
    providerId = DEFAULT_PROVIDER,
  }: {
    targetId: string | number;
    currentVersion: string;
    providerId?: number;
  }): Promise<Maybe<string>> {
    const key = `${targetId}:${currentVersion}:${providerId}`;
    const cached = this.mcuVersionCache.get(key);
    if (cached) return cached;
    const pending = this.computeCurrentMcuVersion({
      targetId,
      currentVersion,
      providerId,
    })
      // A transient failure must not poison the cache: evict the entry so the
      // next poll retries, and surface it to callers as a (non-cached) empty.
      .catch((error) => {
        this.mcuVersionCache.delete(key);
        logger.error(`Manager API MCU lookup failed: ${String(error)}`);
        return Maybe.empty();
      });
    this.mcuVersionCache.set(key, pending);
    return pending;
  }

  private async computeCurrentMcuVersion({
    targetId,
    currentVersion,
    providerId,
  }: {
    targetId: string | number;
    currentVersion: string;
    providerId: number;
  }): Promise<Maybe<string>> {
    // Transient errors (network failure, 5xx) are left to propagate so the
    // caching layer can evict them; only deterministic outcomes reach the
    // `Maybe.empty()` returns below and are safe to cache.
    const deviceVersion = await this.get<DeviceVersionDto>(
      "get_device_version",
      { provider: providerId, target_id: targetId },
    );
    if (deviceVersion?.id === undefined) {
      logger.warn(`Manager API: unknown target_id ${targetId}`);
      return Maybe.empty();
    }

    const currentFirmware = await this.get<FinalFirmwareDto>(
      "get_firmware_version",
      {
        device_version: deviceVersion.id,
        version_name: currentVersion,
        provider: providerId,
      },
    );
    if (currentFirmware?.id === undefined) {
      logger.warn(`Manager API: unknown firmware ${currentVersion}`);
      return Maybe.empty();
    }

    const latest = await this.get<LatestFirmwareDto>("get_latest_firmware", {
      salt: ROLLOUT_SALT,
      current_se_firmware_final_version: currentFirmware.id,
      device_version: deviceVersion.id,
      provider: providerId,
    });
    const osu = latest?.se_firmware_osu_version;
    // When an update is available use the next firmware's MCU list so LLD's
    // shouldFlashMCU check passes against the update target. When the device
    // is already on the latest firmware, the current firmware's list is used
    // — shouldFlashMCU is never evaluated in that case but we still need a
    // valid MCU name so GetOsVersion succeeds.
    const firmwareId =
      latest?.result !== "null" &&
      osu?.next_se_firmware_final_version !== undefined
        ? osu.next_se_firmware_final_version
        : currentFirmware.id;

    const firmware = await this.get<FinalFirmwareDto>(
      `firmware_final_versions/${firmwareId}`,
    );
    const mcuIds = firmware?.mcu_versions ?? [];
    if (mcuIds.length === 0) return Maybe.empty();

    const catalog = (await this.get<McuVersionDto[]>("mcu_versions")) ?? [];
    const compatibleIds = new Set(mcuIds);
    const match = catalog.find(
      (mcu) =>
        mcu.id !== undefined && compatibleIds.has(mcu.id) && Boolean(mcu.name),
    );
    return Maybe.fromNullable(match?.name);
  }

  /**
   * Replicate `getLatestFirmwareForDevice` (non-OSU branch) against the Manager
   * API: `get_device_version` -> `get_firmware_version` -> `get_latest_firmware`
   * -> `firmware_final_versions/{id}`, returning the target final firmware (with
   * its `name` and `mcu_versions`). Memoized — multiple callers with the same
   * key share a single in-flight request. Returns `Nothing` when there is no
   * update or any lookup fails.
   */
  private resolveFinalFirmware(params: {
    targetId: string | number;
    currentVersion: string;
    providerId?: number;
  }): Promise<Maybe<FinalFirmwareDto>> {
    const { targetId, currentVersion, providerId = DEFAULT_PROVIDER } = params;
    const key = `${targetId}:${currentVersion}:${providerId}`;
    const cached = this.finalFirmwareCache.get(key);
    if (cached) return cached;
    const pending = this.fetchFinalFirmware({
      targetId,
      currentVersion,
      providerId,
    })
      // A transient failure must not poison the cache: evict the entry so the
      // next lookup retries, and surface it to callers as a (non-cached) empty.
      .catch((error) => {
        this.finalFirmwareCache.delete(key);
        logger.error(`Manager API firmware lookup failed: ${String(error)}`);
        return Maybe.empty();
      });
    this.finalFirmwareCache.set(key, pending);
    return pending;
  }

  private async fetchFinalFirmware({
    targetId,
    currentVersion,
    providerId,
  }: {
    targetId: string | number;
    currentVersion: string;
    providerId: number;
  }): Promise<Maybe<FinalFirmwareDto>> {
    // Transient errors (network failure, 5xx) are left to propagate so the
    // caching layer can evict them; only deterministic outcomes reach the
    // `Maybe.empty()` returns below and are safe to cache.
    const deviceVersion = await this.get<DeviceVersionDto>(
      "get_device_version",
      { provider: providerId, target_id: targetId },
    );
    if (deviceVersion?.id === undefined) {
      logger.warn(`Manager API: unknown target_id ${targetId}`);
      return Maybe.empty();
    }

    const currentFirmware = await this.get<FinalFirmwareDto>(
      "get_firmware_version",
      {
        device_version: deviceVersion.id,
        version_name: currentVersion,
        provider: providerId,
      },
    );
    if (currentFirmware?.id === undefined) {
      logger.warn(`Manager API: unknown firmware ${currentVersion}`);
      return Maybe.empty();
    }

    const latest = await this.get<LatestFirmwareDto>("get_latest_firmware", {
      salt: ROLLOUT_SALT,
      current_se_firmware_final_version: currentFirmware.id,
      device_version: deviceVersion.id,
      provider: providerId,
    });
    const osu = latest?.se_firmware_osu_version;
    if (
      latest?.result === "null" ||
      !osu?.name ||
      osu.next_se_firmware_final_version === undefined
    ) {
      logger.warn(`Manager API: no firmware update for ${currentVersion}`);
      return Maybe.empty();
    }

    const final = await this.get<FinalFirmwareDto>(
      `firmware_final_versions/${osu.next_se_firmware_final_version}`,
    );
    if (!final?.name) {
      logger.warn(
        `Manager API: no final firmware ${osu.next_se_firmware_final_version}`,
      );
      return Maybe.empty();
    }

    return Maybe.of(final);
  }

  private async get<T>(
    path: string,
    query: Record<string, string | number> = {},
  ): Promise<T | undefined> {
    const params = new URLSearchParams({
      livecommonversion: LIVE_COMMON_VERSION,
    });
    for (const [key, value] of Object.entries(query)) {
      params.set(key, String(value));
    }
    const response = await fetch(`${this.managerApiUrl}/${path}?${params}`);
    if (!response.ok) {
      // 5xx responses are transient: throw so the caller can retry rather than
      // cache the failure. 4xx (e.g. unknown target) is deterministic — return
      // undefined and let the caller resolve to a cacheable Maybe.empty().
      if (response.status >= 500) {
        throw new Error(`Manager API /${path} returned ${response.status}`);
      }
      logger.warn(`Manager API /${path} returned ${response.status}`);
      return undefined;
    }
    return (await response.json()) as T;
  }
}
