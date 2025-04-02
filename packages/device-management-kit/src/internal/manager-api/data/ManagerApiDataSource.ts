import { type EitherAsync } from "purify-ts";

import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import {
  type GetAppByHashParams,
  type GetAppListParams,
  type GetDeviceVersionParams,
  type GetFirmwareVersionParams,
} from "@internal/manager-api/model/Params";

/**
 * Interface representing a data source for the Manager API.
 */
export interface ManagerApiDataSource {
  /**
   * Retrieves the list of applications for a given target ID, provider, and firmware version.
   *
   * @param params - The parameters for getting the application list.
   * @returns EitherAsync containing an array of applications or an HttpFetchApiError.
   */
  getAppList(
    params: GetAppListParams,
  ): EitherAsync<HttpFetchApiError, Application[]>;

  /**
   * Retrieves applications by their hashes.
   *
   * @param hashes - An array of application hashes, can be got from the response of the ListAppsCommand.
   * @returns EitherAsync containing an array of applications or null values, or an HttpFetchApiError.
   */
  getAppsByHash(
    params: GetAppByHashParams,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;

  /**
   * Retrieves the device version for a given target ID and provider.
   *
   * @param params - The parameters for getting the device version.
   * @returns EitherAsync containing the device version or an HttpFetchApiError.
   */
  getDeviceVersion(
    params: GetDeviceVersionParams,
  ): EitherAsync<HttpFetchApiError, DeviceVersion>;

  /**
   * Retrieves the firmware version for a given version, device ID, and provider.
   *
   * @param params - The parameters for getting the firmware version.
   * @returns EitherAsync containing the final firmware or an HttpFetchApiError.
   */
  getFirmwareVersion(
    params: GetFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, FinalFirmware>;

  /**
   * Sets the provider identifier.
   *
   * @param provider - The provider identifier.
   */
  setProvider(provider: number): void;

  /**
   * Returns the current provider.
   */
  getProvider(): number;
}
