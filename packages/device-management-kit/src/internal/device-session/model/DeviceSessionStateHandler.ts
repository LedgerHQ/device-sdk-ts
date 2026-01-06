import { type BehaviorSubject, type Subscription } from "rxjs";

import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import {
  DeviceSessionStateType,
  DeviceStatus,
  type GetAppAndVersionResponse,
  isSuccessCommandResult,
  type TransportConnectedDevice,
} from "@api/index";
import { type CommandResult, type LoggerPublisherService } from "@api/types";
import {
  type DeviceSessionEventDispatcher,
  type NewEvent,
  SessionEvents,
} from "@internal/device-session/model/DeviceSessionEventDispatcher";

export type SetDeviceSessionStateFn = (state: DeviceSessionState) => void;

type NewDeviceStatus = {
  sessionStateType: DeviceSessionStateType;
  deviceStatus: DeviceStatus;
  currentApp: {
    name: string;
    version: string;
  };
};

export class DeviceSessionStateHandler {
  private _subscription: Subscription;
  private readonly _logger: LoggerPublisherService;
  // BUSY is used as the default status when an intent fails, since it is not yet clear
  // whether the device is disconnected or simply unresponsive. The actual disconnection
  // status will be determined and notified asynchronously by the transport layer.
  private _pendingDeviceStatus: DeviceStatus = DeviceStatus.BUSY;

  constructor(
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    private _sessionEventDispatcher: DeviceSessionEventDispatcher,
    private _connectedDevice: TransportConnectedDevice,
    private _deviceState: BehaviorSubject<DeviceSessionState>,
    private setDeviceSessionState: SetDeviceSessionStateFn,
  ) {
    this._subscription = this._sessionEventDispatcher
      .listen()
      .subscribe((event) => this.mapEventAction(event));
    this._logger = loggerModuleFactory("device-session-state-handler");
  }

  private _updateDeviceState(
    parsedResponse: CommandResult<GetAppAndVersionResponse>,
  ): void {
    const newDeviceStatus = this._parseDeviceStatus(parsedResponse);

    if (newDeviceStatus) {
      const { sessionStateType, deviceStatus, currentApp } = newDeviceStatus;
      const state = this._deviceState.getValue();
      if (state.sessionStateType === DeviceSessionStateType.Connected) {
        // When device is connected, initialize fields to default values
        this.setDeviceSessionState({
          sessionStateType,
          deviceStatus,
          deviceModelId: this._connectedDevice.deviceModel.id,
          currentApp,
          installedApps: [],
          isSecureConnectionAllowed: false,
        });
      } else {
        // When device is ready, keep un-modified state fields
        this.setDeviceSessionState({
          ...state,
          sessionStateType,
          deviceStatus,
          deviceModelId: this._connectedDevice.deviceModel.id,
          currentApp,
        });
      }
    }
  }

  private mapEventAction = (event: NewEvent) => {
    const { eventName } = event;
    switch (eventName) {
      case SessionEvents.COMMAND_SUCCEEDED:
        return this._updateDeviceState(event.eventData);
      case SessionEvents.DEVICE_STATE_UPDATE_BUSY:
        return this.setDeviceSessionState({
          ...this._deviceState.getValue(),
          deviceStatus: DeviceStatus.BUSY,
        });
      case SessionEvents.DEVICE_STATE_UPDATE_LOCKED:
        this._pendingDeviceStatus = DeviceStatus.LOCKED;
        return;
      case SessionEvents.DEVICE_STATE_UPDATE_CONNECTED:
        this._pendingDeviceStatus = DeviceStatus.CONNECTED;
        return;
      case SessionEvents.NEW_STATE: {
        // On new state, if an intent is successful,
        // we should have a DEVICE_STATE_UPDATE_LOCKED or DEVICE_STATE_UPDATE_CONNECTED as pending status event
        // If not, we should still have a BUSY status as fallback waiting for the transport to disconnect
        const newDeviceStatus = this._pendingDeviceStatus;
        this._pendingDeviceStatus = DeviceStatus.BUSY;
        return this.setDeviceSessionState({
          ...this._deviceState.getValue(),
          deviceStatus: newDeviceStatus,
        });
      }
      case SessionEvents.DEVICE_STATE_UPDATE_UNKNOWN:
        return this.setDeviceSessionState({
          ...this._deviceState.getValue(),
          deviceStatus: DeviceStatus.BUSY,
        });
      case SessionEvents.REFRESH_NEEDED:
        // This case is handled by the DeviceSessionRefresher
        return;
      default: {
        const uncoveredType: never = eventName;
        throw new Error(`Unhandled context type ${uncoveredType}`);
      }
    }
  };

  private _parseDeviceStatus(
    parsedResponse: CommandResult<GetAppAndVersionResponse>,
  ): NewDeviceStatus | null {
    if (isSuccessCommandResult(parsedResponse)) {
      return {
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: {
          name: parsedResponse.data.name,
          version: parsedResponse.data.version,
        },
      };
    } else {
      this._logger.debug("Error while parsing APDU response", {
        data: { parsedResponse },
      });
      return null;
    }
  }

  public unsubscribe(): void {
    this._subscription.unsubscribe();
  }
}
