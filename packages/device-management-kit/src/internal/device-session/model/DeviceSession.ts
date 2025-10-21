import { type Either } from "purify-ts";
import { BehaviorSubject, type Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { type Command } from "@api/command/Command";
import { type CommandResult } from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceStatus } from "@api/device/DeviceStatus";
import {
  type DeviceAction,
  type DeviceActionIntermediateValue,
  type ExecuteDeviceActionReturnType,
} from "@api/device-action/DeviceAction";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import {
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { type DeviceSessionId } from "@api/device-session/types";
import { type DmkError } from "@api/Error";
import { bufferToHexaString } from "@api/index";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { MutexService } from "@internal/device-session/service/MutexService";
import { RefresherService } from "@internal/device-session/service/RefresherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import { DevicePinger } from "./DevicePinger";
import {
  DeviceSessionEventDispatcher,
  SessionEvents,
} from "./DeviceSessionEventDispatcher";
import { DeviceSessionRefresher } from "./DeviceSessionRefresher";
import { DeviceSessionStateHandler } from "./DeviceSessionStateHandler";

export type SessionConstructorArgs = {
  connectedDevice: TransportConnectedDevice;
  id?: DeviceSessionId;
};

export type DeviceSessionRefresherOptions = {
  isRefresherDisabled: boolean;
  pollingInterval?: number;
};

type SendApduOptions = {
  isPolling?: boolean;
  triggersDisconnection?: boolean;
  abortTimeout?: number;
};

/**
 * Represents a session with a device.
 */
export class DeviceSession {
  private readonly _id: DeviceSessionId;
  private readonly _connectedDevice: TransportConnectedDevice;
  private readonly _deviceState: BehaviorSubject<DeviceSessionState>;
  private readonly _managerApiService: ManagerApiService;
  private readonly _secureChannelService: SecureChannelService;
  private readonly _logger: LoggerPublisherService;
  private readonly _refresherOptions: DeviceSessionRefresherOptions;
  private _pinger: DevicePinger;
  private _deviceSessionRefresher: DeviceSessionRefresher;
  private readonly _refresherService: RefresherService;
  private _commandMutex = new MutexService();
  private _sessionEventDispatcher = new DeviceSessionEventDispatcher();

  constructor(
    { connectedDevice, id = uuidv4() }: SessionConstructorArgs,
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    managerApiService: ManagerApiService,
    secureChannelService: SecureChannelService,
    deviceSessionRefresherOptions: DeviceSessionRefresherOptions | undefined,
  ) {
    this._id = id;
    this._connectedDevice = connectedDevice;
    this._logger = loggerModuleFactory("device-session");
    this._managerApiService = managerApiService;
    this._secureChannelService = secureChannelService;
    this._refresherOptions = {
      ...DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
      ...deviceSessionRefresherOptions,
    };
    this._deviceState = new BehaviorSubject<DeviceSessionState>({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: this._connectedDevice.deviceModel.id,
    });

    this._pinger = new DevicePinger(
      loggerModuleFactory,
      connectedDevice,
      this._sessionEventDispatcher,
      (command, abortTimeout) => this.sendCommand(command, abortTimeout),
    );
    this._deviceSessionRefresher = new DeviceSessionRefresher(
      loggerModuleFactory,
      this._refresherOptions,
      this._sessionEventDispatcher,
      this._connectedDevice,
    );
    new DeviceSessionStateHandler(
      loggerModuleFactory,
      this._sessionEventDispatcher,
      this._connectedDevice,
      this._deviceState,
      (state) => this.setDeviceSessionState(state),
    );

    this._refresherService = new RefresherService(loggerModuleFactory, {
      start: () => this._deviceSessionRefresher.restartRefresher(),
      stop: () => this._deviceSessionRefresher.stopRefresher(),
    });
  }

  public async initialiseSession(): Promise<void> {
    try {
      await this._pinger.ping();
    } catch (error) {
      this._logger.error("Error while initialising session", {
        data: { error },
      });
      throw error;
    } finally {
      if (!this._refresherOptions.isRefresherDisabled) {
        this._deviceSessionRefresher.startRefresher();
      }
    }
  }

  public get id(): DeviceSessionId {
    return this._id;
  }

  public get connectedDevice(): TransportConnectedDevice {
    return this._connectedDevice;
  }

  public get state(): Observable<DeviceSessionState> {
    return this._deviceState.asObservable();
  }

  public getDeviceSessionState(): DeviceSessionState {
    return this._deviceState.getValue();
  }

  public setDeviceSessionState(state: DeviceSessionState): void {
    this._deviceState.next(state);
  }

  public async sendApdu(
    rawApdu: Uint8Array,
    options: SendApduOptions = {
      isPolling: false,
      triggersDisconnection: false,
      abortTimeout: undefined,
    },
  ): Promise<Either<DmkError, ApduResponse>> {
    const release = await this._commandMutex.lock();

    try {
      this._sessionEventDispatcher.dispatch({
        eventName: SessionEvents.DEVICE_STATE_UPDATE_BUSY,
      });

      this._logger.debug(`[exchange] => ${bufferToHexaString(rawApdu)}`);
      const result = await this._connectedDevice.sendApdu(
        rawApdu,
        options.triggersDisconnection,
        options.abortTimeout,
      );

      result
        .ifRight((response: ApduResponse) => {
          this._logger.debug(
            `[exchange] <= ${bufferToHexaString(response.data)}${bufferToHexaString(response.statusCode, false)}`,
          );
          if (CommandUtils.isLockedDeviceResponse(response)) {
            this._sessionEventDispatcher.dispatch({
              eventName: SessionEvents.DEVICE_STATE_UPDATE_LOCKED,
            });
          } else {
            this._sessionEventDispatcher.dispatch({
              eventName: SessionEvents.DEVICE_STATE_UPDATE_CONNECTED,
            });
          }
        })
        .ifLeft(() => {
          this._sessionEventDispatcher.dispatch({
            eventName: SessionEvents.DEVICE_STATE_UPDATE_CONNECTED,
          });
        });
      return result;
    } finally {
      release();
    }
  }

  public async sendCommand<Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
    abortTimeout?: number,
  ): Promise<CommandResult<Response, ErrorStatusCodes>> {
    const apdu = command.getApdu();

    const response = await this.sendApdu(apdu.getRawApdu(), {
      isPolling: false,
      triggersDisconnection: command.triggersDisconnection ?? false,
      abortTimeout,
    });

    return response.caseOf({
      Left: (err) => {
        throw err;
      },
      Right: (r) =>
        command.parseResponse(r, this._connectedDevice.deviceModel.id),
    });
  }

  public executeDeviceAction<
    Output,
    Input,
    E extends DmkError,
    IntermediateValue extends DeviceActionIntermediateValue,
  >(
    deviceAction: DeviceAction<Output, Input, E, IntermediateValue>,
  ): ExecuteDeviceActionReturnType<Output, E, IntermediateValue> {
    const { observable, cancel } = deviceAction._execute({
      sendApdu: async (apdu: Uint8Array) => this.sendApdu(apdu),
      sendCommand: async <Response, ErrorStatusCodes, Args>(
        command: Command<Response, ErrorStatusCodes, Args>,
        abortTimeout?: number,
      ) => this.sendCommand(command, abortTimeout),
      getDeviceModel: () => this._connectedDevice.deviceModel,
      getDeviceSessionState: () => this._deviceState.getValue(),
      getDeviceSessionStateObservable: () => this.state,
      setDeviceSessionState: (state: DeviceSessionState) => {
        this.setDeviceSessionState(state);
        return this._deviceState.getValue();
      },
      disableRefresher: (blockerId: string) =>
        this._refresherService.disableRefresher(blockerId),
      getManagerApiService: () => this._managerApiService,
      getSecureChannelService: () => this._secureChannelService,
    });
    return { observable, cancel };
  }

  public close(): void {
    this._updateDeviceStatus(DeviceStatus.NOT_CONNECTED);
    this._deviceState.complete();
    this._deviceSessionRefresher.stopRefresher();
  }

  public disableRefresher(id: string): () => void {
    return this._refresherService.disableRefresher(id);
  }

  private _updateDeviceStatus(deviceStatus: DeviceStatus): void {
    const state = this._deviceState.getValue();
    this._deviceState.next({ ...state, deviceStatus });
  }
}
