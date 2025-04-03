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
  private readonly _managerApiBaseUrl: string;
  private _provider: number = DEFAULT_PROVIDER;

  constructor(
    @inject(managerApiTypes.DmkConfig)
    { managerApiUrl, provider }: DmkConfig,
  ) {
    this._managerApiBaseUrl = managerApiUrl;
    this._provider = provider;
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
  ): EitherAsync<HttpFetchApiError, Application[]> {
    const { targetId, firmwareVersionName } = params;
    return EitherAsync(() =>
      axios.get<Application[]>(`${this._managerApiBaseUrl}/v2/apps/by-target`, {
        params: {
          target_id: targetId,
          provider: this._provider,
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
    const { targetId } = params;
    return EitherAsync(() =>
      axios.get<DeviceVersion>(
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
      .mapLeft((error) => new HttpFetchApiError(error));
  }

  getFirmwareVersion(
    params: GetFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, FinalFirmware> {
    const { deviceId, version } = params;
    return EitherAsync(() =>
      axios.get<FinalFirmware>(
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
