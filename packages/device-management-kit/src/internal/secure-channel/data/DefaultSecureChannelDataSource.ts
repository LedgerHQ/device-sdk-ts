import { inject, injectable } from "inversify";
import WebSocket from "isomorphic-ws";
import { Either, Left, Right } from "purify-ts";
import URL from "url";

import { type DmkConfig } from "@api/DmkConfig";
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

import { SecureChannelDataSource } from "./SecureChannelDataSource";

@injectable()
export class DefaultSecureChannelDataSource implements SecureChannelDataSource {
  private readonly webSocketBaseUrl: string;

  constructor(
    @inject(secureChannelTypes.DmkConfig)
    { webSocketUrl }: DmkConfig,
  ) {
    this.webSocketBaseUrl = webSocketUrl;
  }

  genuineCheck(
    params: GenuineCheckParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/genuine`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  installApp(
    params: InstallAppsParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/install`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  listInstalledApps(
    params: ListInstalledAppsParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/apps/list`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  uninstallApp(
    params: UninstallAppsParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/install`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  updateFirmware(
    params: UpdateFirmwareParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/install`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  updateMcu(
    params: UpdateMcuParams,
  ): Either<WebSocketConnectionError, WebSocket> {
    const address = URL.format({
      pathname: `${this.webSocketBaseUrl}/mcu`,
      query: params,
    });
    return this._connectWebSocket(address);
  }

  _connectWebSocket(
    address: string,
  ): Either<WebSocketConnectionError, WebSocket> {
    try {
      return Right(new WebSocket(address));
    } catch (error) {
      return Left(new WebSocketConnectionError(error));
    }
  }
}
