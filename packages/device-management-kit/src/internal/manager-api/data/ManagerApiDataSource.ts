import { type EitherAsync } from "purify-ts";

import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import {
  type FinalFirmware,
  type McuFirmware,
  type OsuFirmware,
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

/**
 * Interface representing a data source for the Manager API.
 */
export interface ManagerApiDataSource {
  /**
   * Retrieves the list of applications for a given target ID, and firmware version.
   *
   * @param params - The parameters for getting the application list.
   * @returns EitherAsync containing an array of applications or an HttpFetchApiError.
   */
  getAppList(
    params: GetAppListParams,
  ): EitherAsync<HttpFetchApiError, Array<Application>>;

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
   * Retrieves the device version for a given target ID.
   *
   * @param params - The parameters for getting the device version.
   * @returns EitherAsync containing the device version or an HttpFetchApiError.
   */
  getDeviceVersion(
    params: GetDeviceVersionParams,
  ): EitherAsync<HttpFetchApiError, DeviceVersion>;

  /**
   * Retrieves the firmware version for a given version, device ID.
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

  /**
   * Retrieves a firmware version from a final firmware ID.
   *
   * @param finalFirmwareId - The ID of the final firmware to retrieve.
   * @returns EitherAsync containing the final firmware or an HttpFetchApiError.
   */
  getFirmwareVersionById(
    finalFirmwareId: number,
  ): EitherAsync<HttpFetchApiError, FinalFirmware>;

  /**
   * Retrieves the an OSU firmware version for a given version, device ID.
   *
   * @param params - The parameters for getting the firmware version.
   * @returns EitherAsync containing the OSU firmware or an HttpFetchApiError.
   */
  getOsuFirmwareVersion(
    params: GetFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, OsuFirmware>;

  /**
   * Retrieves the latest firmware available for a given current firmware, device ID.
   *
   * @param params - The parameters for getting the firmware version.
   * @returns EitherAsync containing the OSU firmware or an HttpFetchApiError.
   */
  getLatestFirmwareVersion(
    params: GetLatestFirmwareVersionParams,
  ): EitherAsync<HttpFetchApiError, OsuFirmware>;

  /**
   * Retrieves the available language packages for a device.
   *
   * @param params - The parameters for getting the language packages.
   * @returns EitherAsync containing the list of language packages or an HttpFetchApiError.
   */
  getLanguagePackages(
    params: GetLanguagePackagesParams,
  ): EitherAsync<HttpFetchApiError, Array<LanguagePackage>>;

  /**
   * Retrieves the list of available MCU firmwares.
   *
   * @returns EitherAsync containing an array of mcu firmwares or an HttpFetchApiError.
   */
  getMcuList(): EitherAsync<HttpFetchApiError, Array<McuFirmware>>;
}
