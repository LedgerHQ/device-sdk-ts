import { type EitherAsync } from "purify-ts";

import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

/**
 * Interface representing a data source for the Manager API.
 */
export interface ManagerApiDataSource {
  /**
   * Retrieves applications by their hashes.
   *
   * @param hashes - An array of application hashes.
   * @returns EitherAsync containing an array of applications or null values, or an HttpFetchApiError.
   */
  getAppsByHash(
    hashes: string[],
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;

  /**
   * Retrieves the device version for a given target ID and provider.
   *
   * @param targetId - The target ID of the device.
   * @param provider - The provider number.
   * @returns EitherAsync containing the device version or an HttpFetchApiError.
   */
  getDeviceVersion(
    targetId: string,
    provider: number,
  ): EitherAsync<HttpFetchApiError, DeviceVersion>;

  /**
   * Retrieves the firmware version for a given version, device ID, and provider.
   *
   * @param version - The firmware version.
   * @param deviceId - The device ID.
   * @param provider - The provider number.
   * @returns EitherAsync containing the final firmware or an HttpFetchApiError.
   */
  getFirmwareVersion(
    version: string,
    deviceId: number,
    provider: number,
  ): EitherAsync<HttpFetchApiError, FinalFirmware>;
}
