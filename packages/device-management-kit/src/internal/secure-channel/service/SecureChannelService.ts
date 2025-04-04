import type WebSocket from "isomorphic-ws";
import { type Either } from "purify-ts";

import { type GetOsVersionResponse } from "@api/index";
import { type Application } from "@internal/manager-api/model/Application";
import {
  type FinalFirmware,
  type OsuFirmware,
} from "@internal/manager-api/model/Firmware";
import { type WebSocketConnectionError } from "@internal/secure-channel/model/Errors";

/**
 * Interface representing a secure channel service for device management.
 */
export interface SecureChannelService {
  /**
   * Construct a WebSocket connection for genuine check.
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @param finalFirmware - Response of the GetFirmwareVersion HTTP request in manager API.
   * @returns Either a WebSocketConnectionError or a WebSocket.
   */
  genuineCheck(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Construct a WebSocket connection for installing an application.
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @param app - The application to be installed, must have perso, firmware, firmwareKey, and hash properties.
   * @returns Either a WebSocketConnectionError or a WebSocket.
   */
  installApp(
    deviceInfo: GetOsVersionResponse,
    app: Pick<Application, "perso" | "firmware" | "firmwareKey" | "hash">,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Construct a WebSocket connection for listing installed applications.
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @param finalFirmware - Response of the GetFirmwareVersion HTTP request in manager API.
   * @returns Either a WebSocketConnectionError or a WebSocket.
   */
  listInstalledApps(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Construct a WebSocket connection for uninstalling an application.
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @param app - The application to be uninstalled, must have perso, delete, deleteKey, and hash properties.
   * @returns Either a WebSocketConnectionError or a WebSocket.
   */
  uninstallApp(
    deviceInfo: GetOsVersionResponse,
    app: Pick<Application, "perso" | "delete" | "deleteKey" | "hash">,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Construct a WebSocket connection for updating the firmware of the device.
   * @param deviceInfo - Response of the GetOsVersionCommand.
   * @param osuFirmware - The osu firmware to be updated.
   * @returns Either a WebSocketConnectionError or a WebSocket.
   */
  updateFirmware(
    deviceInfo: GetOsVersionResponse,
    osuFirmware: OsuFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;

  /**
   * Construct a WebSocket connection for updating the MCU (Microcontroller Unit) of the device.
   * @param deviceInfo -  Response of the GetOsVersionCommand.
   * @param param - Parameters for the MCU update, including the version.
   * @returns Either a WebSocketConnectionError or a WebSocket.
   */
  updateMcu(
    deviceInfo: GetOsVersionResponse,
    param: { version: string },
  ): Either<WebSocketConnectionError, WebSocket>;
}
