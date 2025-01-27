import type WebSocket from "isomorphic-ws";
import { type Either, type EitherAsync } from "purify-ts";

import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import {
  type HttpFetchApiError,
  type WebSocketConnectionError,
} from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import type {
  GenuineCheckParams,
  InstallAppsParams,
  ListInstalledAppsParams,
  UninstallAppsParams,
  UpdateFirmwareParams,
  UpdateMcuParams,
} from "@internal/manager-api/model/Params";

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

  /**
   * Performs a genuine check on the device.
   *
   * @param params - The parameters required for the genuine check.
   * @returns Either containing a WebSocket connection or a WebSocketConnectionError.
   */
  genuineCheck(
    params: GenuineCheckParams,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Lists the installed applications on the device.
   *
   * @param params - The parameters required for the genuine check.
   * @returns Either containing a WebSocket connection or a WebSocketConnectionError.
   */
  listInstalledApps(
    params: ListInstalledAppsParams,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Updates the MCU (Microcontroller Unit) of the device.
   *
   * @param params - The parameters required to update the MCU.
   * @returns Either containing a WebSocket connection or a WebSocketConnectionError.
   */
  updateMcu(
    params: UpdateMcuParams,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Updates the firmware of the device.
   *
   * @param params - The parameters required to update the firmware.
   * @returns Either containing a WebSocket connection or a WebSocketConnectionError.
   */
  updateFirmware(
    params: UpdateFirmwareParams,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Installs applications on the device.
   *
   * @param params - The parameters required to install the applications.
   * @returns Either containing a WebSocket connection or a WebSocketConnectionError.
   */
  installApp(
    params: InstallAppsParams,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Uninstalls applications from the device.
   *
   * @param params - The parameters required to uninstall the applications.
   * @returns Either containing a WebSocket connection or a WebSocketConnectionError.
   */
  uninstallApp(
    params: UninstallAppsParams,
  ): Either<WebSocketConnectionError, WebSocket>;
}
