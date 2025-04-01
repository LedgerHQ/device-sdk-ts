import { type EitherAsync } from "purify-ts";

import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

/**
 * Interface representing the Manager API service.
 */
export interface ManagerApiService {
  /**
   * Retrieves the list of applications for a given device.
   *
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @returns An `EitherAsync` containing either an `HttpFetchApiError` or an array of `Application` objects.
   */
  getAppList(
    deviceInfo: GetOsVersionResponse,
  ): EitherAsync<HttpFetchApiError, Array<Application>>;

  /**
   * Retrieves applications by their hash values.
   *
   * @param appHashes - An array of application hash values.
   * @returns An `EitherAsync` containing either an `HttpFetchApiError` or an array of `Application` objects or `null`.
   */
  getAppsByHash(
    appHashes: Array<string>,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;

  /**
   * Retrieves the device version for a given device.
   *
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @returns An `EitherAsync` containing either an `HttpFetchApiError` or a `DeviceVersion` object.
   */
  getDeviceVersion(
    deviceInfo: GetOsVersionResponse,
  ): EitherAsync<HttpFetchApiError, DeviceVersion>;

  /**
   * Retrieves the firmware version for a given device.
   *
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @param deviceVersion - Response of the GetDeviceVersion HTTP request.
   * @returns An `EitherAsync` containing either an `HttpFetchApiError` or a `FinalFirmware` object.
   */
  getFirmwareVersion(
    deviceInfo: GetOsVersionResponse,
    deviceVersion: DeviceVersion,
  ): EitherAsync<HttpFetchApiError, FinalFirmware>;
}
