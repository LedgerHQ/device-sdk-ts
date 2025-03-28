import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import {
  type GetAppByHashParams,
  type GetAppListParams,
  type GetDeviceVersionParams,
  type GetFirmwareVersionParams,
} from "@internal/manager-api/model/Params";

import { type ManagerApiService } from "./ManagerApiService";

@injectable()
export class DefaultManagerApiService implements ManagerApiService {
  constructor(
    @inject(managerApiTypes.ManagerApiDataSource)
    private readonly dataSource: ManagerApiDataSource,
  ) {}

  getAppList(
    deviceInfo: GetOsVersionResponse,
  ): EitherAsync<HttpFetchApiError, Array<Application>> {
    const params: GetAppListParams = {
      targetId: deviceInfo.targetId.toString(),
      firmwareVersionName: deviceInfo.seVersion,
    };
    return this.dataSource.getAppList(params);
  }

  getDeviceVersion(deviceInfo: GetOsVersionResponse) {
    const params: GetDeviceVersionParams = {
      targetId: deviceInfo.targetId.toString(),
    };
    return this.dataSource.getDeviceVersion(params);
  }

  getFirmwareVersion(
    deviceInfo: GetOsVersionResponse,
    deviceVersion: DeviceVersion,
  ) {
    const params: GetFirmwareVersionParams = {
      version: deviceInfo.seVersion,
      deviceId: deviceVersion.id,
    };
    return this.dataSource.getFirmwareVersion(params);
  }

  getAppsByHash(appHashes: Array<string>) {
    const params: GetAppByHashParams = {
      hashes: appHashes,
    };
    return EitherAsync<HttpFetchApiError, Array<Application | null>>(
      async ({ fromPromise, throwE }) => {
        if (params.hashes.length === 0) {
          return [];
        }
        try {
          const response = await fromPromise(
            this.dataSource.getAppsByHash(params),
          );
          return response;
        } catch (error) {
          if (error instanceof HttpFetchApiError) {
            return throwE(error);
          }
          return throwE(new HttpFetchApiError(error));
        }
      },
    );
  }
}
