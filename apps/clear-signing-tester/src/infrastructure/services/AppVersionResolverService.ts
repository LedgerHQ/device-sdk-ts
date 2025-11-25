import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { existsSync, readdirSync, statSync } from "fs";
import { inject, injectable } from "inversify";
import { join } from "path";
import semver from "semver";

import { TYPES } from "@root/src/di/types";
import { type AppsConfig } from "@root/src/domain/models/config/AppsConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import {
  type AppVersionResolver,
  type ResolvedAppVersion,
} from "@root/src/domain/services/AppVersionResolver";

@injectable()
export class AppVersionResolverService implements AppVersionResolver {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.AppsConfig)
    private readonly appsConfig: AppsConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = this.loggerFactory("app-version-resolver");
  }

  resolve(
    device: SpeculosConfig["device"],
    requestedOs?: string,
    requestedVersion?: string,
  ): ResolvedAppVersion {
    this.logger.debug(
      `Resolving app version for device=${device}, os=${requestedOs || "auto"}, version=${requestedVersion || "auto"}`,
    );

    const devicePath = join(this.appsConfig.path, device);

    if (!existsSync(devicePath)) {
      throw new Error(
        `Device directory not found: ${devicePath}. Please ensure COIN_APPS_PATH is set correctly.`,
      );
    }

    // Get all available OS versions for this device
    const availableOsVersions = this.getAvailableOsVersions(devicePath);

    if (availableOsVersions.length === 0) {
      throw new Error(
        `No OS versions found for device ${device} at path: ${devicePath}`,
      );
    }

    let resolvedOs: string;
    let resolvedVersion: string;

    if (requestedOs && requestedVersion) {
      // Both specified: validate they exist
      const appPath = this.buildAppPath(device, requestedOs, requestedVersion);
      if (!existsSync(appPath)) {
        throw new Error(
          `No Ethereum app found for device=${device}, os=${requestedOs}, version=${requestedVersion}`,
        );
      }
      resolvedOs = requestedOs;
      resolvedVersion = requestedVersion;
    } else if (requestedOs) {
      // Only OS specified: find latest app version for this OS
      const versions = this.getAvailableAppVersions(devicePath, requestedOs);
      if (versions.length === 0) {
        throw new Error(
          `No Ethereum app versions found for device=${device}, os=${requestedOs}`,
        );
      }
      resolvedOs = requestedOs;
      resolvedVersion = this.getLatestVersion(versions);
    } else if (requestedVersion) {
      // Only version specified: find latest OS with this app version
      const compatibleOs = this.findOsWithAppVersion(
        device,
        availableOsVersions,
        requestedVersion,
      );
      if (!compatibleOs) {
        throw new Error(
          `No OS version found with Ethereum app version ${requestedVersion} for device ${device}`,
        );
      }
      resolvedOs = compatibleOs;
      resolvedVersion = requestedVersion;
    } else {
      // Neither specified: find latest OS and latest app version
      const result = this.findLatestOsAndAppVersion(
        devicePath,
        availableOsVersions,
      );
      if (!result) {
        throw new Error(`No Ethereum app found for device ${device}`);
      }
      resolvedOs = result.os;
      resolvedVersion = result.version;
    }

    const resolvedPath = this.buildAppPath(device, resolvedOs, resolvedVersion);

    this.logger.info(
      `Resolved app: device=${device}, os=${resolvedOs}, version=${resolvedVersion}`,
    );
    this.logger.debug(`App path: ${resolvedPath}`);

    return {
      os: resolvedOs,
      version: resolvedVersion,
      path: resolvedPath,
    };
  }

  private getAvailableOsVersions(devicePath: string): string[] {
    try {
      return readdirSync(devicePath).filter((name) => {
        const fullPath = join(devicePath, name);
        return statSync(fullPath).isDirectory();
      });
    } catch (error) {
      this.logger.error(`Failed to read device directory: ${devicePath}`, {
        data: { error },
      });
      return [];
    }
  }

  private getAvailableAppVersions(
    devicePath: string,
    osVersion: string,
  ): string[] {
    const ethereumPath = join(devicePath, osVersion, "Ethereum");

    if (!existsSync(ethereumPath)) {
      return [];
    }

    try {
      const files = readdirSync(ethereumPath);
      const versions: string[] = [];

      for (const file of files) {
        // Match app_X.Y.Z.elf pattern
        const match = file.match(/^app_(\d+\.\d+\.\d+)\.elf$/);
        if (match && match[1]) {
          versions.push(match[1]);
        }
      }

      return versions;
    } catch (error) {
      this.logger.error(
        `Failed to read Ethereum app directory: ${ethereumPath}`,
        {
          data: { error },
        },
      );
      return [];
    }
  }

  private findOsWithAppVersion(
    device: string,
    osVersions: string[],
    appVersion: string,
  ): string | null {
    // Sort OS versions in descending order to get the latest first
    const sortedOsVersions = this.sortVersionsDescending(osVersions);

    for (const osVersion of sortedOsVersions) {
      const appPath = this.buildAppPath(device, osVersion, appVersion);
      if (existsSync(appPath)) {
        return osVersion;
      }
    }

    return null;
  }

  private findLatestOsAndAppVersion(
    devicePath: string,
    osVersions: string[],
  ): { os: string; version: string } | null {
    // Sort OS versions in descending order
    const sortedOsVersions = this.sortVersionsDescending(osVersions);

    // For each OS version (starting with the latest), find the latest app version
    for (const osVersion of sortedOsVersions) {
      const appVersions = this.getAvailableAppVersions(devicePath, osVersion);
      if (appVersions.length > 0) {
        const latestAppVersion = this.getLatestVersion(appVersions);
        return {
          os: osVersion,
          version: latestAppVersion,
        };
      }
    }

    return null;
  }

  private getLatestVersion(versions: string[]): string {
    return this.sortVersionsDescending(versions)[0] ?? "0.0.0";
  }

  private sortVersionsDescending(versions: string[]): string[] {
    return versions.sort((a, b) => semver.rcompare(a, b));
  }

  private buildAppPath(
    device: string,
    osVersion: string,
    appVersion: string,
  ): string {
    return join(
      this.appsConfig.path,
      device,
      osVersion,
      "Ethereum",
      `app_${appVersion}.elf`,
    );
  }
}
