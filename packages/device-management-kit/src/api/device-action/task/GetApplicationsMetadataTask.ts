import { gt } from "semver";

import { InvalidStatusWordError } from "@api/command/Errors";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { ListLanguagePackCommand } from "@api/command/os/ListLanguagePackCommand";
import type { InternalApi } from "@api/device-action/DeviceAction";
import {
  type Catalog,
  type FirmwareVersion,
  type InstalledLanguagePackage,
} from "@api/device-session/DeviceSessionState";
import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export type InstalledApp = {
  hash: string;
  hashCode: string;
  name: string;
};

export type GetApplicationsMetadataTaskArgs = {
  deviceVersion: DeviceVersion;
  firmware: FinalFirmware;
  firmwareVersion: FirmwareVersion;
  installedApps: InstalledApp[];
};

export type GetApplicationsMetadataTaskResult = CommandResult<{
  applications: Application[];
  applicationsUpdates: Application[];
  installedLanguages: InstalledLanguagePackage[];
  catalog: Catalog;
}>;

const ZERO_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export class GetApplicationsMetadataTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetApplicationsMetadataTaskArgs,
  ) {}

  async run(): Promise<GetApplicationsMetadataTaskResult> {
    // Get applications metadata
    const installedApps = this.args.installedApps.filter((app) =>
      this.isApplication(app),
    );
    const manager = this.api.getManagerApiService();
    const appHashes = installedApps.map((app) => app.hash);
    const result = await manager
      .getAppsByHash(appHashes)
      .chain((applications) =>
        manager
          .getAppList(this.args.firmwareVersion.metadata!)
          .map((catalog) => ({ applications, catalog })),
      );
    if (result.isLeft()) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Cannot get the application catalog"),
      });
    }
    const { applications, catalog } = result.unsafeCoerce();

    // Complete applications metadata using the catalog if needed
    const appsWithMetadata = applications.reduce((apps, app, index) => {
      if (app !== null) {
        // Is the app hash was found in app store, append its metadata
        return [...apps, app];
      }
      // For apps with non-deterministic hash (ie. Security Key, sideloaded app, ...),
      // use metadata of latest version from the catalog
      const installedApp = installedApps[index]!;
      const catalogApp = catalog.find(
        (c) => c.versionName === installedApp.name,
      );
      return catalogApp ? [...apps, catalogApp] : apps;
    }, [] as Application[]);

    // Filter apps metadata and catalog
    const filteredApps = applications.filter((app) => app !== null);
    const filteredCatalog = filteredApps.reduce((apps, app) => {
      const catalogApp = catalog.find((c) => c.versionName === app.versionName);
      if (catalogApp && gt(catalogApp.version, app.version)) {
        return [...apps, catalogApp];
      }
      return apps;
    }, [] as Application[]);

    // Get install language packages
    let installedLanguages: InstalledLanguagePackage[] = [];
    for (let i = 0; ; i++) {
      const language = await this.api.sendCommand(
        new ListLanguagePackCommand({ firstChunk: i === 0 }),
      );
      if (!isSuccessCommandResult(language) || language.data === undefined) {
        break;
      }
      installedLanguages = [...installedLanguages, language.data];
    }

    // Get all the available language packs for the device
    const languages = await manager.getLanguagePackages(
      this.args.deviceVersion,
      this.args.firmware,
    );
    if (languages.isRight()) {
      // Return the application metadata
      return CommandResultFactory({
        data: {
          applications: appsWithMetadata,
          applicationsUpdates: filteredCatalog,
          installedLanguages,
          catalog: {
            applications: catalog,
            languagePackages: languages.extract(),
          },
        },
      });
    } else {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Cannot get the languages catalog"),
      });
    }
  }

  private isApplication(app: InstalledApp): boolean {
    // Applications with no "code" hash are not real applications
    // (typically a language package).
    return app.hashCode !== ZERO_HASH;
  }
}
