import type WebSocket from "isomorphic-ws";
import { type Either } from "purify-ts";

import { type GetOsVersionResponse } from "@api/index";
import { type Application } from "@internal/manager-api/model/Application";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import { type WebSocketConnectionError } from "@internal/secure-channel/model/Errors";

/**
 * Interface representing the Secure Channel Service.
 * Some parameters are placeholders and will be updated when relative HTTP requests are ready.
 */
export interface SecureChannelService {
  genuineCheck(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;
  installApp(
    deviceInfo: GetOsVersionResponse,
    app: Application,
  ): Either<WebSocketConnectionError, WebSocket>;
  listInstalledApps(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;
  uninstallApp(
    deviceInfo: GetOsVersionResponse,
    app: Application,
  ): Either<WebSocketConnectionError, WebSocket>;
  updateFirmware(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;
  updateFirmware(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket>;
  // TODO: Update the parameters
  updateMcu(
    deviceInfo: GetOsVersionResponse,
    param: { version: string },
  ): Either<WebSocketConnectionError, WebSocket>;
}
