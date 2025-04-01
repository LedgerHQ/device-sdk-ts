import { inject, injectable } from "inversify";
import WebSocket from "isomorphic-ws";
import { Either } from "purify-ts";

import { type GetOsVersionResponse } from "@api/index";
import { type Application } from "@internal/manager-api/model/Application";
import {
  type FinalFirmware,
  type OsuFirmware,
} from "@internal/manager-api/model/Firmware";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { WebSocketConnectionError } from "@internal/secure-channel/model/Errors";
import {
  type GenuineCheckParams,
  type InstallAppsParams,
  type ListInstalledAppsParams,
  type UninstallAppsParams,
  type UpdateFirmwareParams,
  type UpdateMcuParams,
} from "@internal/secure-channel/model/Params";

import { type SecureChannelService } from "./SecureChannelService";

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

  installApp(
    deviceInfo: GetOsVersionResponse,
    app: Pick<Application, "perso" | "firmware" | "firmwareKey" | "hash">,
  ): Either<WebSocketConnectionError, WebSocket> {
    const { perso, firmware, firmwareKey, hash } = app;
    const params: InstallAppsParams = {
      targetId: deviceInfo.targetId.toString(),
      perso,
      firmware,
      firmwareKey,
      hash,
    };
    return this.dataSource.installApp(params);
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

  uninstallApp(
    deviceInfo: GetOsVersionResponse,
    app: Pick<Application, "perso" | "delete" | "deleteKey" | "hash">,
  ): Either<WebSocketConnectionError, WebSocket> {
    const { perso, delete: appDelete, deleteKey, hash } = app;
    const params: UninstallAppsParams = {
      targetId: deviceInfo.targetId.toString(),
      perso,
      firmware: appDelete,
      firmwareKey: deleteKey,
      hash,
    };
    return this.dataSource.uninstallApp(params);
  }

  updateFirmware(
    deviceInfo: GetOsVersionResponse,
    osuFirmware: OsuFirmware,
  ): Either<WebSocketConnectionError, WebSocket> {
    const params: UpdateFirmwareParams = {
      targetId: deviceInfo.targetId.toString(),
      perso: osuFirmware.perso,
      firmware: osuFirmware.firmware,
      firmwareKey: osuFirmware.firmwareKey,
    };
    return this.dataSource.updateFirmware(params);
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
}
