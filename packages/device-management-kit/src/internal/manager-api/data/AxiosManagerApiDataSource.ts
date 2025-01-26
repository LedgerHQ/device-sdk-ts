import axios from "axios";
import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type DmkConfig } from "@api/DmkConfig";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import {
  type Application,
  AppType,
} from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

import { ManagerApiDataSource } from "./ManagerApiDataSource";
import { ApplicationDto, AppTypeDto } from "./ManagerApiDto";

@injectable()
export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  private readonly managerApiBaseUrl: string;
  private readonly webSocketBaseUrl: string;

  constructor(
    @inject(managerApiTypes.DmkConfig)
    { managerApiUrl, webSocketUrl }: DmkConfig,
  ) {
    this.managerApiBaseUrl = managerApiUrl;
    this.webSocketBaseUrl = webSocketUrl;
    console.log(this.webSocketBaseUrl);
  }

  getDeviceVersion(
    targetId: string,
    provider: number,
  ): EitherAsync<HttpFetchApiError, DeviceVersion> {
    return EitherAsync(() =>
      axios.get<DeviceVersion>(`${this.managerApiBaseUrl}/get_device_version`, {
        params: {
          target_id: targetId,
          provider,
        },
      }),
    )
      .map((res) => res.data)
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getFirmwareVersion(
    version: string,
    deviceId: number,
    provider: number,
  ): EitherAsync<HttpFetchApiError, FinalFirmware> {
    return EitherAsync(() =>
      axios.get<FinalFirmware>(
        `${this.managerApiBaseUrl}/get_firmware_version`,
        {
          params: {
            device_version: deviceId,
            version_name: version,
            provider,
          },
        },
      ),
    )
      .map((res) => res.data)
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getAppsByHash(
    hashes: string[],
  ): EitherAsync<HttpFetchApiError, Array<Application | null>> {
    return EitherAsync(() =>
      axios.post<Array<ApplicationDto | null>>(
        `${this.managerApiBaseUrl}/v2/apps/hash`,
        hashes,
      ),
    )
      .map((res) => res.data)
      .map((apps) => this.mapApplicationDtoToApplication(apps))
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  private mapAppTypeDtoToAppType(appType: AppTypeDto): AppType {
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
    apps: Array<ApplicationDto | null>,
  ): Array<Application | null> {
    return apps.map((app) => {
      if (app === null) {
        return null;
      }

      const { applicationType, ...rest } = app;

      return {
        ...rest,
        applicationType: this.mapAppTypeDtoToAppType(applicationType),
      };
    });
  }
}
