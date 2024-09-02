import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
import { CommandResult } from "@api/command/model/CommandResult";
import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceStatus } from "@api/device/DeviceStatus";
import {
  DeviceAction,
  DeviceActionIntermediateValue,
  ExecuteDeviceActionReturnType,
} from "@api/device-action/DeviceAction";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { DeviceSessionId } from "@api/device-session/types";
import { SdkError } from "@api/Error";
import { DefaultEventDispatcher } from "@internal/event-dispatcher/service/DefaultEventDispatcher";
import { EventDispatcher } from "@internal/event-dispatcher/service/EventDispatcher";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
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
  private readonly _refresher: DeviceSessionRefresher;
  private readonly _managerApiService: ManagerApiService;
  private readonly _deviceState: EventDispatcher<DeviceSessionState>;

  constructor(
    { connectedDevice, id = uuidv4() }: SessionConstructorArgs,
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    managerApiService: ManagerApiService,
  ) {
    this._id = id;
    this._connectedDevice = connectedDevice;

    this._deviceState = new DefaultEventDispatcher<DeviceSessionState>({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
    });

    this._refresher = new DeviceSessionRefresher(
      {
        refreshInterval: 1000,
        deviceState: this._deviceState,
        sendApduFn: (rawApdu: Uint8Array) =>
          this.sendApdu(rawApdu, {
            isPolling: true,
            triggersDisconnection: false,
          }),
      },
      loggerModuleFactory("device-session-refresher"),
    );

    this._managerApiService = managerApiService;
  }

  public get id() {
    return this._id;
  }

  public get connectedDevice() {
    return this._connectedDevice;
  }

  public get state() {
    return this._deviceState.listen();
  }

  public setDeviceSessionState(state: DeviceSessionState) {
    this._deviceState.dispatch(state);
  }

  async sendApdu(
    rawApdu: Uint8Array,
    options: { isPolling: boolean; triggersDisconnection: boolean } = {
      isPolling: false,
      triggersDisconnection: false,
    },
  ) {
    if (!options.isPolling) {
      this._deviceState.dispatch({
        deviceStatus: DeviceStatus.BUSY,
      });
    }

    const errorOrResponse = await this._connectedDevice.sendApdu(
      rawApdu,
      options.triggersDisconnection,
    );

    return errorOrResponse.ifRight((response) => {
      if (CommandUtils.isLockedDeviceResponse(response)) {
        this._deviceState.dispatch({
          deviceStatus: DeviceStatus.LOCKED,
        });
      } else {
        this._deviceState.dispatch({
          deviceStatus: DeviceStatus.CONNECTED,
        });
      }
    });
  }

  async sendCommand<Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
  ): Promise<CommandResult<Response, ErrorStatusCodes>> {
    const apdu = command.getApdu();
    const response = await this.sendApdu(apdu.getRawApdu(), {
      isPolling: false,
      triggersDisconnection: command.triggersDisconnection ?? false,
    });

    return response.caseOf({
      Left: (err) => {
        throw err;
      },
      Right: (r) =>
        command.parseResponse(r, this._connectedDevice.deviceModel.id),
    });
  }

  executeDeviceAction<
    Output,
    Input,
    Error extends SdkError,
    IntermediateValue extends DeviceActionIntermediateValue,
  >(
    deviceAction: DeviceAction<Output, Input, Error, IntermediateValue>,
  ): ExecuteDeviceActionReturnType<Output, Error, IntermediateValue> {
    const { observable, cancel } = deviceAction._execute({
      sendCommand: async <Response, ErrorStatusCodes, Args>(
        command: Command<Response, ErrorStatusCodes, Args>,
      ) => this.sendCommand(command),
      getDeviceSessionState: () => this._deviceState.get(),
      getDeviceSessionStateObservable: () => this.state,
      setDeviceSessionState: (state: DeviceSessionState) => {
        this.setDeviceSessionState(state);
        return this._deviceState.get();
      },
      getMetadataForAppHashes: (apps: ListAppsResponse) =>
        this._managerApiService.getAppsByHash(apps),
    });

    return {
      observable,
      cancel,
    };
  }

  close() {
    this._deviceState.dispatch({
      deviceStatus: DeviceStatus.NOT_CONNECTED,
    });

    this._refresher.stop();
    this._deviceState.close();
  }
}
