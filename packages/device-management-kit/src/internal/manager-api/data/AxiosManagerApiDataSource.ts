import axios from "axios";
import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type DmkConfig } from "@api/DmkConfig";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import {
  type Application,
  AppType,
} from "@internal/manager-api/model/Application";
import { DEFAULT_PROVIDER } from "@internal/manager-api/model/Const";
import { DEFAULT_FIRMWARE_DISTRIBUTION_SALT } from "@internal/manager-api/model/Const";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import type {
  FinalFirmware,
  McuFirmware,
  OsuFirmware,
} from "@internal/manager-api/model/Firmware";
import { type LanguagePackage } from "@internal/manager-api/model/Language";
import {
  type GetAppByHashParams,
  type GetAppListParams,
  type GetDeviceVersionParams,
  type GetFirmwareVersionParams,
  type GetLanguagePackagesParams,
  type GetLatestFirmwareVersionParams,
} from "@internal/manager-api/model/Params";

import { ManagerApiDataSource } from "./ManagerApiDataSource";
import {
  ApplicationDto,
  AppTypeDto,
  DeviceVersionDto,
  FirmwareFinalVersionDto,
  FirmwareOsuVersionDto,
  LanguagePackageVersionDto,
  LatestFirmwareOsuVersionResponseDto,
  McuVersionDto,
} from "./ManagerApiDto";

@injectable()
export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  private readonly _managerApiBaseUrl: string;
  private _provider: number = DEFAULT_PROVIDER;
  private _firmwareDistributionSalt: string =
    DEFAULT_FIRMWARE_DISTRIBUTION_SALT;

  constructor(
    @inject(managerApiTypes.DmkConfig)
    { managerApiUrl, provider, firmwareDistributionSalt }: DmkConfig,
  ) {
    this._managerApiBaseUrl = managerApiUrl;
    this._provider = provider;
    this._firmwareDistributionSalt = firmwareDistributionSalt;
  }

  setProvider(provider: number): void {
    if (this._provider === provider || provider < 1) {
      return;
    }
    this._provider = provider;
  }

  getProvider(): number {
    return this._provider;
  }

  getAppList(
    params: GetAppListParams,
  ): EitherAsync<HttpFetchApiError, Array<Application>> {
    const { targetId, firmwareVersionName } = params;
    return EitherAsync(() =>
      axios.get<Array<ApplicationDto>>(
        `${this._managerApiBaseUrl}/v2/apps/by-target`,
        {
          params: {
            target_id: targetId,
            provider: this._provider,
            firmware_version_name: firmwareVersionName,
          },
        },
      ),
    )
      .map((res) => res.data)
      .chain((apps) => this.mapApplicationDtoToApplication(apps))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getMcuList(): EitherAsync<HttpFetchApiError, Array<McuFirmware>> {
    return EitherAsync(() =>
      axios.get<Array<McuVersionDto>>(
        `${this._managerApiBaseUrl}/mcu_versions`,
        {},
      ),
    )
      .map((res) => res.data)
      .chain((mcus) => this.mapMcuDtoToMcu(mcus))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getDeviceVersion(
    params: GetDeviceVersionParams,
  ): EitherAsync<HttpFetchApiError, DeviceVersion> {
    const { targetId } = params;
    return EitherAsync(() =>
      axios.get<DeviceVersionDto>(
        `${this._managerApiBaseUrl}/get_device_version`,
        {
          params: {
            target_id: targetId,
            provider: this._provider,
          },
        },
      ),
    )
      .map((res) => res.data)
      .chain((deviceVersion) => this.mapDeviceVersionDto(deviceVersion))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getFirmwareVersion(
    params: GetFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, FinalFirmware> {
    const { deviceId, version } = params;
    return EitherAsync(() =>
      axios.get<FirmwareFinalVersionDto>(
        `${this._managerApiBaseUrl}/get_firmware_version`,
        {
          params: {
            device_version: deviceId,
            version_name: version,
            provider: this._provider,
          },
        },
      ),
    )
      .map((res) => res.data)
      .chain((finalFirmware) => this.mapFinalFirmwareDto(finalFirmware))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getFirmwareVersionById(
    finalFirmwareId: number,
  ): EitherAsync<HttpFetchApiError, FinalFirmware> {
    return EitherAsync(() =>
      axios.get<FirmwareFinalVersionDto>(
        `${this._managerApiBaseUrl}/firmware_final_versions/${finalFirmwareId}`,
        {},
      ),
    )
      .map((res) => res.data)
      .chain((finalFirmware) => this.mapFinalFirmwareDto(finalFirmware))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getOsuFirmwareVersion(
    params: GetFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, OsuFirmware> {
    const { deviceId, version } = params;
    return EitherAsync(() =>
      axios.get<FirmwareOsuVersionDto>(
        `${this._managerApiBaseUrl}/get_osu_version`,
        {
          params: {
            device_version: deviceId,
            version_name: version,
            provider: this._provider,
          },
        },
      ),
    )
      .map((res) => res.data)
      .chain((osuFirmware) => this.mapOsuFirmwareDto(osuFirmware))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getLatestFirmwareVersion(
    params: GetLatestFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, OsuFirmware> {
    const livecommonversion = "34.27.0"; // Legacy parameter that should just be a too old
    const { currentFinalFirmwareId, deviceId } = params;
    return EitherAsync(() =>
      axios.get<LatestFirmwareOsuVersionResponseDto>(
        `${this._managerApiBaseUrl}/get_latest_firmware`,
        {
          params: {
            current_se_firmware_final_version: currentFinalFirmwareId,
            device_version: deviceId,
            provider: this._provider,
            salt: this._firmwareDistributionSalt,
            livecommonversion,
          },
        },
      ),
    )
      .map((res) => res.data)
      .chain((latestFirmware) => this.mapLatestFirmwareDto(latestFirmware))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getAppsByHash(
    params: GetAppByHashParams,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>> {
    const { hashes } = params;
    return EitherAsync(() =>
      axios.post<Array<ApplicationDto | null>>(
        `${this._managerApiBaseUrl}/v2/apps/hash`,
        hashes,
      ),
    )
      .map((res) => res.data)
      .chain((apps) => this.mapNullableApplicationDtoToApplication(apps))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getLanguagePackages(
    params: GetLanguagePackagesParams,
  ): EitherAsync<HttpFetchApiError, Array<LanguagePackage>> {
    const { deviceId, currentFinalFirmwareId } = params;
    return EitherAsync(() =>
      axios.get<Array<LanguagePackageVersionDto>>(
        `${this._managerApiBaseUrl}/language-packages`,
        {
          params: {
            device_version: deviceId,
            current_se_firmware_final_version: currentFinalFirmwareId,
          },
        },
      ),
    )
      .map((res) => res.data)
      .chain((apps) => this.mapLanguagesDtoToLanguages(apps))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  private mapAppTypeDtoToAppType(appType: AppTypeDto | null): AppType | null {
    if (appType === null) {
      return null;
    }
    switch (appType) {
      case AppTypeDto.currency:
        return AppType.currency;
      case AppTypeDto.plugin:
        return AppType.plugin;
      case AppTypeDto.tool:
        return AppType.tool;
      case AppTypeDto.swap:
        return AppType.swap;
    }
  }

  private mapApplicationDtoToApplication(
    apps: Array<ApplicationDto>,
  ): EitherAsync<Error, Array<Application>> {
    return EitherAsync(() =>
      Promise.resolve(apps.map((app) => this.mapApplicationDto(app))),
    );
  }

  private mapNullableApplicationDtoToApplication(
    apps: Array<ApplicationDto | null>,
  ): EitherAsync<Error, Array<Application | null>> {
    return EitherAsync(() =>
      Promise.resolve(
        apps.map((app) => {
          if (app === null) {
            return null;
          }
          return this.mapApplicationDto(app);
        }),
      ),
    );
  }

  private mapApplicationDto(app: ApplicationDto): Application {
    if (
      typeof app !== "object" ||
      typeof app.versionId !== "number" ||
      typeof app.versionName !== "string" ||
      (app.versionDisplayName !== null &&
        typeof app.versionDisplayName !== "string") ||
      typeof app.version !== "string" ||
      (app.currencyId !== null && typeof app.currencyId !== "string") ||
      (app.description !== null && typeof app.description !== "string") ||
      (app.applicationType !== null &&
        typeof app.applicationType !== "string") ||
      typeof app.dateModified !== "string" ||
      (app.icon !== null && typeof app.icon !== "string") ||
      (app.authorName !== null && typeof app.authorName !== "string") ||
      (app.supportURL !== null && typeof app.supportURL !== "string") ||
      (app.contactURL !== null && typeof app.contactURL !== "string") ||
      (app.sourceURL !== null && typeof app.sourceURL !== "string") ||
      (app.compatibleWallets !== null &&
        typeof app.compatibleWallets !== "string") ||
      typeof app.hash !== "string" ||
      typeof app.perso !== "string" ||
      typeof app.firmware !== "string" ||
      typeof app.firmwareKey !== "string" ||
      typeof app.delete !== "string" ||
      typeof app.deleteKey !== "string" ||
      (app.bytes !== null && typeof app.bytes !== "number") ||
      (app.warning !== null && typeof app.warning !== "string") ||
      typeof app.isDevTools !== "boolean" ||
      (app.category !== null && typeof app.category !== "number") ||
      (app.parent !== null && typeof app.parent !== "number") ||
      (app.parentName !== null && typeof app.parentName !== "string")
    ) {
      throw new Error(`Incomplete application: ${JSON.stringify(app)}`);
    }
    const {
      applicationType,
      hash,
      perso,
      firmware,
      firmwareKey,
      delete: del,
      deleteKey,
      ...rest
    } = app;
    const ret: Application = {
      ...rest,
      hash: hash!,
      perso: perso!,
      firmware: firmware!,
      firmwareKey: firmwareKey!,
      delete: del!,
      deleteKey: deleteKey!,
      applicationType: this.mapAppTypeDtoToAppType(applicationType),
    };
    return ret;
  }

  private mapMcuDtoToMcu(
    mcus: Array<McuVersionDto>,
  ): EitherAsync<Error, Array<McuFirmware>> {
    return EitherAsync(() =>
      Promise.resolve(
        mcus.map((mcu) => {
          if (
            typeof mcu !== "object" ||
            typeof mcu.id !== "number" ||
            typeof mcu.name !== "string"
          ) {
            throw new Error(`Incomplete MCU version: ${JSON.stringify(mcu)}`);
          }
          const ret: McuFirmware = {
            id: mcu.id,
            name: mcu.name,
          };
          return ret;
        }),
      ),
    );
  }

  private mapDeviceVersionDto(
    deviceVersion: DeviceVersionDto,
  ): EitherAsync<Error, DeviceVersion> {
    return EitherAsync(() => {
      if (
        typeof deviceVersion !== "object" ||
        typeof deviceVersion.id !== "number"
      ) {
        throw new Error(
          `Incomplete device version: ${JSON.stringify(deviceVersion)}`,
        );
      }
      const ret: DeviceVersion = {
        id: deviceVersion.id,
      };
      return Promise.resolve(ret);
    });
  }

  private mapFinalFirmwareDto(
    finalFirmware: FirmwareFinalVersionDto,
  ): EitherAsync<Error, FinalFirmware> {
    return EitherAsync(() => {
      if (
        typeof finalFirmware !== "object" ||
        typeof finalFirmware.id !== "number" ||
        typeof finalFirmware.version !== "string" ||
        typeof finalFirmware.perso !== "string" ||
        (finalFirmware.firmware !== null &&
          typeof finalFirmware.firmware !== "string") ||
        (finalFirmware.firmware_key !== null &&
          typeof finalFirmware.firmware_key !== "string") ||
        (finalFirmware.hash !== null &&
          typeof finalFirmware.hash !== "string") ||
        (finalFirmware.bytes !== null &&
          typeof finalFirmware.bytes !== "number") ||
        !Array.isArray(finalFirmware.mcu_versions)
      ) {
        throw new Error(
          `Incomplete final firmware: ${JSON.stringify(finalFirmware)}`,
        );
      }
      const ret: FinalFirmware = {
        id: finalFirmware.id,
        version: finalFirmware.version,
        perso: finalFirmware.perso,
        firmware: finalFirmware.firmware,
        firmwareKey: finalFirmware.firmware_key,
        hash: finalFirmware.hash,
        bytes: finalFirmware.bytes,
        mcuVersions: finalFirmware.mcu_versions,
      };
      return Promise.resolve(ret);
    });
  }

  private mapLatestFirmwareDto(
    latestFirmware: LatestFirmwareOsuVersionResponseDto,
  ): EitherAsync<Error, OsuFirmware> {
    return EitherAsync<Error, FirmwareOsuVersionDto>(() => {
      if (
        latestFirmware.result !== "success" ||
        !latestFirmware.se_firmware_osu_version
      ) {
        throw new Error(
          `Latest firmware could not be retrieved: ${latestFirmware.result}`,
        );
      }
      const osuDto = latestFirmware.se_firmware_osu_version;
      return Promise.resolve(osuDto);
    }).chain((osuDto) => this.mapOsuFirmwareDto(osuDto));
  }

  private mapOsuFirmwareDto(
    osuDto: FirmwareOsuVersionDto,
  ): EitherAsync<Error, OsuFirmware> {
    return EitherAsync(() => {
      if (
        typeof osuDto !== "object" ||
        typeof osuDto.id !== "number" ||
        typeof osuDto.perso !== "string" ||
        typeof osuDto.firmware !== "string" ||
        typeof osuDto.firmware_key !== "string" ||
        (osuDto.hash !== null && typeof osuDto.hash !== "string") ||
        typeof osuDto.next_se_firmware_final_version !== "number"
      ) {
        throw new Error(
          `Incomplete latest firmware: ${JSON.stringify(osuDto)}`,
        );
      }
      const ret: OsuFirmware = {
        id: osuDto.id,
        perso: osuDto.perso,
        firmware: osuDto.firmware,
        firmwareKey: osuDto.firmware_key,
        hash: osuDto.hash,
        nextFinalFirmware: osuDto.next_se_firmware_final_version,
      };
      return Promise.resolve(ret);
    });
  }

  private mapLanguagesDtoToLanguages(
    languages: Array<LanguagePackageVersionDto>,
  ): EitherAsync<Error, Array<LanguagePackage>> {
    return EitherAsync(() =>
      Promise.resolve(
        languages.map((language) => this.mapLanguageDto(language)),
      ),
    );
  }

  private mapLanguageDto(language: LanguagePackageVersionDto): LanguagePackage {
    if (
      typeof language !== "object" ||
      typeof language.language !== "string" ||
      typeof language.languagePackageVersionId !== "number" ||
      typeof language.version !== "string" ||
      typeof language.language_package_id !== "number" ||
      typeof language.apdu_install_url !== "string" ||
      typeof language.apdu_uninstall_url !== "string" ||
      typeof language.bytes !== "number" ||
      typeof language.date_creation !== "string" ||
      typeof language.date_last_modified !== "string"
    ) {
      throw new Error(
        `Incomplete language version: ${JSON.stringify(language)}`,
      );
    }
    const ret: LanguagePackage = {
      language: language.language,
      languagePackageVersionId: language.languagePackageVersionId,
      version: language.version,
      languagePackageId: language.language_package_id,
      apduInstallUrl: language.apdu_install_url,
      apduUninstallUrl: language.apdu_uninstall_url,
      bytes: language.bytes,
      dateCreation: language.date_creation,
      dateLastModified: language.date_last_modified,
    };
    return ret;
  }
}
