import { inject, injectable } from "inversify";
import WebSocket from "isomorphic-ws";
import { Either } from "purify-ts";

import { GetOsVersionResponse } from "@api/index";
import { FinalFirmware } from "@internal/manager-api/model/Firmware";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { WebSocketConnectionError } from "@internal/secure-channel/model/Errors";
import {
  GenuineCheckParams,
  InstallAppsParams,
  ListInstalledAppsParams,
  UninstallAppsParams,
  UpdateFirmwareParams,
  UpdateMcuParams,
} from "@internal/secure-channel/model/Params";

import { SecureChannelService } from "./SecureChannelService";

@injectable()
export class DefaultSecureChannelService implements SecureChannelService {
  constructor(
    @inject(secureChannelTypes.SecureChannelDataSource)
    private readonly dataSource: SecureChannelDataSource,
  ) {}

  genuineCheck(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: GenuineCheckParams = {
      targetId: deviceInfo.targetId.toString(),
      perso: finalFirmware.perso,
    };
    return this.dataSource.genuineCheck(params);
  }

  listInstalledApps(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: ListInstalledAppsParams = {
      targetId: deviceInfo.targetId.toString(),
      perso: finalFirmware.perso,
    };
    return this.dataSource.listInstalledApps(params);
  }

  updateMcu(
    deviceInfo: GetOsVersionResponse,
    param: { version: string },
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: UpdateMcuParams = {
      targetId: deviceInfo.targetId.toString(),
      version: param.version,
    };
    return this.dataSource.updateMcu(params);
  }

  updateFirmware(
    deviceInfo: GetOsVersionResponse,
    finalFirmware: FinalFirmware,
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: UpdateFirmwareParams = {
      targetId: deviceInfo.targetId.toString(),
      perso: finalFirmware.perso,
      firmware: finalFirmware.firmware,
      firmwareKey: finalFirmware.firmwareKey,
    };
    return this.dataSource.updateFirmware(params);
  }

  installApp(
    deviceInfo: GetOsVersionResponse,
    perso: string,
    firmware: string,
    firmwareKey: string,
    deleteKey: string,
    hash: string,
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: InstallAppsParams = {
      targetId: deviceInfo.targetId.toString(),
      perso,
      firmware,
      firmwareKey,
      deleteKey,
      hash,
    };
    return this.dataSource.installApp(params);
  }

  uninstallApp(
    deviceInfo: GetOsVersionResponse,
    perso: string,
    firmware: string,
    firmwareKey: string,
    deleteKey: string,
    hash: string,
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: UninstallAppsParams = {
      targetId: deviceInfo.targetId.toString(),
      perso,
      firmware,
      firmwareKey,
      deleteKey,
      hash,
    };
    return this.dataSource.uninstallApp(params);
  }
}
