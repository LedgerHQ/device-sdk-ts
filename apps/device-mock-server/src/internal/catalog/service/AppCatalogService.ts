import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { appTypes } from "@internal/di/types";
import { logger } from "@internal/logger/logger";
import { targetIdForModel } from "@internal/os/service/osApdus";

/** Production Manager API, used when no override is configured. */
const DEFAULT_MANAGER_API_URL = "https://manager.api.live.ledger.com/api";

/** Ledger's own app provider, the one Ledger Live reads by default. */
const PROVIDER = 1;

/** Shape of the entries returned by the Manager API `/v2/apps/by-target`. */
interface ApplicationDto {
  readonly versionName?: string;
  readonly version?: string;
}

/** An app that really exists for a given device model and firmware. */
export interface CatalogEntry {
  readonly name: string;
  readonly version: string;
}

/** Whether an OS version was ever released for a device model. */
export interface FirmwareCheck {
  readonly exists: boolean;
  /** The Manager API's own name for the model, e.g. "Flex". */
  readonly model: string;
}

/** The `/get_device_version` fields this uses. */
interface DeviceVersionDto {
  readonly id?: number;
  readonly name?: string;
}

/**
 * The apps a device model on a given firmware can actually run.
 *
 * An app version is tied to a firmware version: the same app has a different
 * version on Flex 1.6.1 than on Nano X 2.7.1, and Speculos resolves the ELF at
 * `/apps/{device}/{firmware}/{App}/app_{version}.elf`, so a version guessed
 * against the wrong firmware simply is not there. The Manager API keys its app
 * list on exactly the same two values the device reports in its handshake — the
 * target id and the firmware version — so it is asked rather than guessed.
 */
@injectable()
export class AppCatalogService {
  private readonly managerApiUrl: string;
  /**
   * Answers per `targetId:firmware`. The Manager API's list for a released
   * firmware does not move, and the configuration UI re-asks on every model or
   * firmware edit, so repeat questions are answered locally.
   */
  private readonly cache = new Map<string, CatalogEntry[]>();
  /** Manager API device version per target id; fixed per model. */
  private readonly deviceVersions = new Map<number, DeviceVersionDto>();
  /** Firmware existence per `targetId:firmware`. */
  private readonly firmwareChecks = new Map<string, FirmwareCheck>();

  constructor(@inject(appTypes.Config) config: MockServerConfig) {
    this.managerApiUrl = config.managerApiUrl ?? DEFAULT_MANAGER_API_URL;
  }

  /**
   * Whether an OS version was ever released for a model.
   *
   * Speculos boots the OS by this exact name (`/apps/{device}/{firmware}/…`), so
   * a version that never shipped leaves it with nothing to run — and the app
   * list for such a firmware comes back empty, which reads as "no apps" when
   * the real answer is "no such OS".
   */
  async checkFirmware(
    deviceType: string,
    firmwareVersion: string,
  ): Promise<Either<string, FirmwareCheck>> {
    const targetId = targetIdForModel(deviceType);
    if (targetId === undefined) {
      return Left(`Unknown device model "${deviceType}"`);
    }

    const key = `${targetId}:${firmwareVersion}`;
    const cached = this.firmwareChecks.get(key);
    if (cached) return Right(cached);

    const deviceVersion = await this.deviceVersion(targetId);
    if (deviceVersion.isLeft()) {
      return Left(deviceVersion.leftOrDefault("Unknown device model"));
    }
    const resolved = deviceVersion.unsafeCoerce();
    const model = resolved.name ?? deviceType;

    const params = new URLSearchParams({
      device_version: String(resolved.id),
      version_name: firmwareVersion,
      provider: String(PROVIDER),
    });

    try {
      const response = await fetch(
        `${this.managerApiUrl}/get_firmware_version?${params}`,
      );
      // 404 is how the Manager API says "no such OS version" — an answer, not
      // a failure.
      if (!response.ok && response.status !== 404) {
        logger.warn(
          `Manager API /get_firmware_version returned ${response.status} for ${key}`,
        );
        return Left("The Manager API could not confirm this OS version");
      }
      const check: FirmwareCheck = { exists: response.ok, model };
      this.firmwareChecks.set(key, check);
      return Right(check);
    } catch (error) {
      logger.error(
        `Manager API firmware check failed for ${key}: ${String(error)}`,
      );
      return Left("Could not reach the Manager API");
    }
  }

  /** The Manager API device version behind a target id. */
  private async deviceVersion(
    targetId: number,
  ): Promise<Either<string, DeviceVersionDto>> {
    const cached = this.deviceVersions.get(targetId);
    if (cached) return Right(cached);
    try {
      const params = new URLSearchParams({
        target_id: String(targetId),
        provider: String(PROVIDER),
      });
      const response = await fetch(
        `${this.managerApiUrl}/get_device_version?${params}`,
      );
      if (!response.ok) {
        logger.warn(
          `Manager API /get_device_version returned ${response.status} for target ${targetId}`,
        );
        return Left("The Manager API does not know this device model");
      }
      const dto = (await response.json()) as DeviceVersionDto;
      if (dto.id === undefined) {
        return Left("The Manager API returned no device version");
      }
      this.deviceVersions.set(targetId, dto);
      return Right(dto);
    } catch (error) {
      logger.error(
        `Manager API device version failed for target ${targetId}: ${String(error)}`,
      );
      return Left("Could not reach the Manager API");
    }
  }

  async list(
    deviceType: string,
    firmwareVersion: string,
  ): Promise<Either<string, CatalogEntry[]>> {
    const targetId = targetIdForModel(deviceType);
    if (targetId === undefined) {
      return Left(`Unknown device model "${deviceType}"`);
    }

    const key = `${targetId}:${firmwareVersion}`;
    const cached = this.cache.get(key);
    if (cached) return Right(cached);

    const params = new URLSearchParams({
      target_id: String(targetId),
      provider: String(PROVIDER),
      firmware_version_name: firmwareVersion,
    });

    try {
      const response = await fetch(
        `${this.managerApiUrl}/v2/apps/by-target?${params}`,
      );
      if (!response.ok) {
        logger.warn(
          `Manager API /v2/apps/by-target returned ${response.status} for ${key}`,
        );
        return Left(
          `The Manager API knows no apps for ${deviceType} on firmware ${firmwareVersion}`,
        );
      }
      const apps = (await response.json()) as ApplicationDto[];
      const entries = this.toEntries(apps);
      this.cache.set(key, entries);
      return Right(entries);
    } catch (error) {
      logger.error(`Manager API app list failed for ${key}: ${String(error)}`);
      return Left("Could not reach the Manager API");
    }
  }

  /** Keep the named, versioned apps, one per name, sorted for display. */
  private toEntries(apps: ApplicationDto[]): CatalogEntry[] {
    const byName = new Map<string, CatalogEntry>();
    for (const app of apps) {
      if (!app.versionName || !app.version) continue;
      if (!byName.has(app.versionName)) {
        byName.set(app.versionName, {
          name: app.versionName,
          version: app.version,
        });
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
