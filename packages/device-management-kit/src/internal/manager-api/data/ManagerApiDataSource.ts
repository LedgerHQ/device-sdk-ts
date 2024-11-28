import { type EitherAsync } from "purify-ts";

import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export interface ManagerApiDataSource {
  getAppsByHash(
    hashes: string[],
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;
  getDeviceVersion(
    targetId: string,
    provider: number,
  ): EitherAsync<HttpFetchApiError, DeviceVersion>;
  getFirmwareVersion(
    version: string,
    deviceId: number,
    provider: number,
  ): EitherAsync<HttpFetchApiError, FinalFirmware>;
}
