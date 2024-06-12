import { inject } from "inversify";
import { BehaviorSubject } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { DeviceSessionId } from "@api/device-session/types";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

import { DeviceSessionRefresher } from "./DeviceSessionRefresher";

export type SessionConstructorArgs = {
  connectedDevice: InternalConnectedDevice;
  id?: DeviceSessionId;
};

/**
 * Represents a session with a device.
 */
export class DeviceSession {
  private readonly _id: DeviceSessionId;
  private readonly _connectedDevice: InternalConnectedDevice;
  private readonly _deviceState: BehaviorSubject<DeviceSessionState>;
  private readonly _refresher: DeviceSessionRefresher;

  constructor(
    { connectedDevice, id = uuidv4() }: SessionConstructorArgs,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._id = id;
    this._connectedDevice = connectedDevice;
    this._deviceState = new BehaviorSubject<DeviceSessionState>({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
    });
    this._refresher = new DeviceSessionRefresher(
      {
        refreshInterval: 1000,
        deviceStatus: DeviceStatus.CONNECTED,
        sendApduFn: (rawApdu: Uint8Array) =>
          this.sendApdu(rawApdu, { isPolling: true }),
        updateStateFn: (state: DeviceSessionState) =>
          this.setDeviceSessionState(state),
      },
      loggerModuleFactory("device-session-refresher"),
    );
  }

  public get id() {
    return this._id;
  }

  public get connectedDevice() {
    return this._connectedDevice;
  }

  public get state() {
    return this._deviceState.asObservable();
  }

  public setDeviceSessionState(state: DeviceSessionState) {
    this._deviceState.next(state);
  }

  private updateDeviceStatus(deviceStatus: DeviceStatus) {
    const sessionState = this._deviceState.getValue();
    this._refresher.setDeviceStatus(deviceStatus);
    this._deviceState.next({
      ...sessionState,
      deviceStatus,
    });
  }

  async sendApdu(
    rawApdu: Uint8Array,
    options: { isPolling: boolean } = { isPolling: false },
  ) {
    if (!options.isPolling) this.updateDeviceStatus(DeviceStatus.BUSY);

    const errorOrResponse = await this._connectedDevice.sendApdu(rawApdu);

    return errorOrResponse.ifRight((response) => {
      if (CommandUtils.isLockedDeviceResponse(response)) {
        this.updateDeviceStatus(DeviceStatus.LOCKED);
      } else {
        this.updateDeviceStatus(DeviceStatus.CONNECTED);
      }
    });
  }

  sendCommand<Response, Args>(command: Command<Response, Args>) {
    return async (deviceModelId: DeviceModelId): Promise<Response> => {
      const apdu = command.getApdu();
      const response = await this.sendApdu(apdu.getRawApdu());

      return response.caseOf({
        Left: (err) => {
          throw err;
        },
        Right: (r) => command.parseResponse(r, deviceModelId),
      });
    };
  }

  close() {
    this.updateDeviceStatus(DeviceStatus.NOT_CONNECTED);
    this._deviceState.complete();
  }
}
