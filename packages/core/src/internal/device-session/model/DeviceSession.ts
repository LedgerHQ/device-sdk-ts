import { BehaviorSubject } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
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
import { EventBus } from "@internal/device-session/utils/Events";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

import { DeviceSessionRefresher } from "./DeviceSessionRefresher";

export type SessionConstructorArgs = {
  connectedDevice: InternalConnectedDevice;
  id?: DeviceSessionId;
};

type UpdateDeviceStatusEvent = CustomEvent<{ deviceStatus: DeviceStatus }>;
type UpdateSessionStateEvent = CustomEvent<{
  sessionState: Partial<DeviceSessionState>;
}>;

type RefresherEvents = UpdateDeviceStatusEvent | UpdateSessionStateEvent;

class EventManager<T extends RefresherEvents> extends EventBus<T> {
  updateDeviceStatus(deviceStatus: DeviceStatus) {
    this.dispatchCustomEvent("updateDeviceStatus", { deviceStatus });
  }

  updateSessionState(sessionState: Partial<DeviceSessionState>) {
    this.dispatchCustomEvent("updateSessionState", {
      sessionState,
    });
  }
}

/**
 * Represents a session with a device.
 */
export class DeviceSession {
  private readonly _id: DeviceSessionId;
  private readonly _connectedDevice: InternalConnectedDevice;
  private readonly _deviceState: BehaviorSubject<DeviceSessionState>;
  private readonly _refresher: DeviceSessionRefresher;
  private readonly _managerApiService: ManagerApiService;
  readonly eventManager: EventManager<RefresherEvents>;

  constructor(
    { connectedDevice, id = uuidv4() }: SessionConstructorArgs,
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    managerApiService: ManagerApiService,
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
        deviceState: this._deviceState,
        sendApduFn: (rawApdu: Uint8Array) =>
          this.sendApdu(rawApdu, {
            isPolling: true,
            triggersDisconnection: false,
          }),
        updateDeviceSessionState: (state: Partial<DeviceSessionState>) => {
          this.eventManager.updateSessionState(state);
        },
      },
      loggerModuleFactory("device-session-refresher"),
    );
    this._managerApiService = managerApiService;
    this.eventManager = new EventManager();

    // WIP: EVENT SYSTEM
    this.eventManager.addCustomEventListener<UpdateDeviceStatusEvent>(
      "updateDeviceStatus",
      (event) => {
        const state = this._deviceState.getValue();
        this.updateDeviceSessionState({
          ...state,
          deviceStatus: event.detail.deviceStatus,
        });
      },
    );

    this.eventManager.addCustomEventListener<UpdateSessionStateEvent>(
      "updateSessionState",
      (event) => {
        const state = this._deviceState.getValue();
        const newState = {
          ...state,
          ...event.detail.sessionState,
          // I know I don't like it either but it seems that
          // spreading a Partial<DeviceSessionState> after a full state
          // creates an error in the type system
        } as DeviceSessionState;
        this.updateDeviceSessionState(newState);
      },
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

  public updateDeviceSessionState(state: DeviceSessionState) {
    this._deviceState.next(state);
  }

  async sendApdu(
    rawApdu: Uint8Array,
    options: { isPolling: boolean; triggersDisconnection: boolean } = {
      isPolling: false,
      triggersDisconnection: false,
    },
  ) {
    if (!options.isPolling) {
      this.eventManager.dispatchCustomEvent("updateDeviceStatus", {
        deviceStatus: DeviceStatus.BUSY,
      });
    }

    const errorOrResponse = await this._connectedDevice.sendApdu(
      rawApdu,
      options.triggersDisconnection,
    );

    return errorOrResponse.ifRight((response) => {
      if (CommandUtils.isLockedDeviceResponse(response)) {
        this.eventManager.dispatchCustomEvent("updateDeviceStatus", {
          deviceStatus: DeviceStatus.LOCKED,
        });
      } else {
        this.eventManager.dispatchCustomEvent("updateDeviceStatus", {
          deviceStatus: DeviceStatus.CONNECTED,
        });
      }
    });
  }

  async sendCommand<Response, Args>(
    command: Command<Response, Args>,
  ): Promise<Response> {
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
      sendCommand: async <Response, Args>(command: Command<Response, Args>) =>
        this.sendCommand(command),
      getDeviceSessionState: () => this._deviceState.getValue(),
      getDeviceSessionStateObservable: () => this.state,
      setDeviceSessionState: (state: DeviceSessionState) => {
        this.updateDeviceSessionState(state);
        return this._deviceState.getValue();
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
    // this.updateDeviceStatus(DeviceStatus.NOT_CONNECTED);
    this.eventManager.updateDeviceStatus(DeviceStatus.NOT_CONNECTED);
    this._deviceState.complete();
    this._refresher.stop();
    this.eventManager.removeEventListener("updateDeviceStatus", null);
    this.eventManager.removeEventListener("updateDeviceSessionState", null);
  }
}
