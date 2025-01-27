import axios from "axios";
import { inject, injectable } from "inversify";
import WebSocket from "isomorphic-ws";
import { Either, EitherAsync, Left, Right } from "purify-ts";
import URL from "url";

import { type DmkConfig } from "@api/DmkConfig";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import {
  type Application,
  AppType,
} from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import {
  HttpFetchApiError,
  WebSocketConnectionError,
} from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import {
  GenuineCheckParams,
  InstallAppsParams,
  ListInstalledAppsParams,
  UninstallAppsParams,
  UpdateFirmwareParams,
  UpdateMcuParams,
} from "@internal/manager-api/model/Params";

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

  genuineCheck(
    params: GenuineCheckParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/genuine`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  listInstalledApps(
    params: ListInstalledAppsParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/apps/list`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  updateMcu(
    params: UpdateMcuParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/mcu`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  updateFirmware(
    params: UpdateFirmwareParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/install`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  installApp(
    params: InstallAppsParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/install`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  uninstallApp(
    params: UninstallAppsParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/install`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  _connectWebSocket(
    address: string,
  ): Either<WebSocketConnectionError, WebSocket> {
    try {
      return Right(new WebSocket(address));
    } catch (error) {
      return Left(new WebSocketConnectionError(error));
    }
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
