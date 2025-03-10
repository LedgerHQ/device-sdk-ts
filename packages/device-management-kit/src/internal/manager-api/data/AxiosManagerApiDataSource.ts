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
import {
  type GetAppByHashParams,
  type GetAppListParams,
  type GetDeviceVersionParams,
  type GetFirmwareVersionParams,
} from "@internal/manager-api/model/Params";

import { ManagerApiDataSource } from "./ManagerApiDataSource";
import { ApplicationDto, AppTypeDto } from "./ManagerApiDto";

@injectable()
export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  private readonly managerApiBaseUrl: string;

  constructor(
    @inject(managerApiTypes.DmkConfig)
    { managerApiUrl }: DmkConfig,
  ) {
    this.managerApiBaseUrl = managerApiUrl;
  }

  getAppList(
    params: GetAppListParams,
  ): EitherAsync<HttpFetchApiError, Application[]> {
    const { targetId, provider, firmwareVersionName } = params;
    return EitherAsync(() =>
      axios.get<Application[]>(`${this.managerApiBaseUrl}/v2/apps/by-target`, {
        params: {
          target_id: targetId,
          provider,
          firmware_version_name: firmwareVersionName,
        },
      }),
    )
      .map((res) => res.data)
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getDeviceVersion(
    params: GetDeviceVersionParams,
  ): EitherAsync<HttpFetchApiError, DeviceVersion> {
    const { targetId, provider } = params;
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
    params: GetFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, FinalFirmware> {
    const { deviceId, version, provider } = params;
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
    params: GetAppByHashParams,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>> {
    const { hashes } = params;
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
