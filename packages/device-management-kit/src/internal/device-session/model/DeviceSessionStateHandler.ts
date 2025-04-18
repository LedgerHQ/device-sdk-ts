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

      this.setDeviceSessionState({
        sessionStateType,
        deviceStatus,
        deviceModelId: this._connectedDevice.deviceModel.id,
        currentApp,
        installedApps: [],
        isSecureConnectionAllowed: false,
      });
    }
  }

  private mapEventAction = (event: NewEvent) => {
    switch (event.eventName) {
      case SessionEvents.COMMAND_SUCCEEDED:
        return this._updateDeviceState(event.eventData);
      case SessionEvents.DEVICE_STATE_UPDATE_BUSY:
        return this.setDeviceSessionState({
          ...this._deviceState.getValue(),
          deviceStatus: DeviceStatus.BUSY,
        });
      case SessionEvents.DEVICE_STATE_UPDATE_LOCKED:
        return this.setDeviceSessionState({
          ...this._deviceState.getValue(),
          deviceStatus: DeviceStatus.LOCKED,
        });
      case SessionEvents.DEVICE_STATE_UPDATE_CONNECTED:
        return this.setDeviceSessionState({
          ...this._deviceState.getValue(),
          deviceStatus: DeviceStatus.CONNECTED,
        });
      default:
        return null;
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
