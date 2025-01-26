import type WebSocket from "isomorphic-ws";
import { type Either } from "purify-ts";

import { type WebSocketConnectionError } from "@internal/secure-channel/model/Errors";
import type {
  GenuineCheckParams,
  InstallAppsParams,
  ListInstalledAppsParams,
  UninstallAppsParams,
  UpdateFirmwareParams,
  UpdateMcuParams,
} from "@internal/secure-channel/model/Params";

/**
 * Interface representing a data source for the Manager API.
 */
export interface SecureChannelDataSource {
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
