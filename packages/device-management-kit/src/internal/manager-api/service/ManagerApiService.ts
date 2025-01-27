import { type EitherAsync } from "purify-ts";

import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import { type ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export interface ManagerApiService {
  getAppsByHash(
    apps: ListAppsResponse,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;
  getDeviceVersion(
    deviceInfo: GetOsVersionResponse,
    provider: number,
  ): EitherAsync<HttpFetchApiError, DeviceVersion>;
  getFirmwareVersion(
    deviceInfo: GetOsVersionResponse,
    deviceVersion: DeviceVersion,
    provider: number,
  ): EitherAsync<HttpFetchApiError, FinalFirmware>;
}
