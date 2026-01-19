import { type Either } from "purify-ts";
import {
  BehaviorSubject,
  from,
  lastValueFrom,
  type Observable,
  timeout,
} from "rxjs";
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
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import {
  SendApduTimeoutError,
  SendCommandTimeoutError,
} from "@api/transport/model/Errors";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import {
  formatApduReceivedLog,
  formatApduSendingLog,
} from "@api/utils/apduLogs";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { IntentQueueService } from "@internal/device-session/service/IntentQueueService";
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
  private readonly _intentQueueService: IntentQueueService;
  private _sessionEventDispatcher = new DeviceSessionEventDispatcher();
  private _bypassIntentQueue: boolean = false;

  constructor(
    { connectedDevice, id = uuidv4() }: SessionConstructorArgs,
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    managerApiService: ManagerApiService,
    secureChannelService: SecureChannelService,
    deviceSessionRefresherOptions: DeviceSessionRefresherOptions | undefined,
    intentQueueServiceFactory: (
      sessionEventDispatcher: DeviceSessionEventDispatcher,
    ) => IntentQueueService = (sessionEventDispatcher) =>
      new IntentQueueService(loggerModuleFactory, sessionEventDispatcher),
  ) {
    this._id = id;
    this._connectedDevice = connectedDevice;
    this._logger = loggerModuleFactory("device-session");
    this._managerApiService = managerApiService;
    this._intentQueueService = intentQueueServiceFactory(
      this._sessionEventDispatcher,
    );
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
      if (this._refresherOptions.isRefresherDisabled) await this._pinger.ping();
      else this._deviceSessionRefresher.startRefresher();
    } catch (error) {
      this._logger.error("Error while initialising session", {
        data: { error },
      });
      throw error;
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

  public sendApdu(
    rawApdu: Uint8Array,
    options: SendApduOptions = {
      isPolling: false,
      triggersDisconnection: false,
      abortTimeout: undefined,
    },
  ): Promise<Either<DmkError, ApduResponse>> {
    // Bypass intent queue if flag is set
    if (this._bypassIntentQueue) {
      return this._unsafeInternalSendApdu(rawApdu, options);
    }
    return this._internalSendApdu(rawApdu, options);
  }

  private _internalSendApdu(
    rawApdu: Uint8Array,
    options: SendApduOptions,
  ): Promise<Either<DmkError, ApduResponse>> {
    const abortTimeout = options.abortTimeout;
    const beforeQueuedTimestamp = Date.now();
    const { observable, cancel } = this._intentQueueService.enqueue({
      type: "send-apdu",
      execute: () =>
        from(
          (async () => {
            const elapsedTime = Date.now() - beforeQueuedTimestamp;
            const result = await this._unsafeInternalSendApdu(rawApdu, {
              isPolling: options.isPolling,
              triggersDisconnection: options.triggersDisconnection,
              // Subtract the elapsed time to account for the time spent in the queue
              // to sync both observable and transport timeout
              abortTimeout: abortTimeout
                ? abortTimeout - elapsedTime
                : undefined,
            });
            return result;
          })(),
        ),
    });

    const timeoutObservable = abortTimeout
      ? observable.pipe(
          timeout({
            each: abortTimeout,
            with: () => {
              cancel();
              throw new SendApduTimeoutError();
            },
          }),
        )
      : observable;

    return lastValueFrom(timeoutObservable);
  }

  private async _unsafeInternalSendApdu(
    rawApdu: Uint8Array,
    options: SendApduOptions = {
      isPolling: false,
      triggersDisconnection: false,
      abortTimeout: undefined,
    },
  ): Promise<Either<DmkError, ApduResponse>> {
    this._logger.debug(formatApduSendingLog(rawApdu));
    const result = await this._connectedDevice.sendApdu(
      rawApdu,
      options.triggersDisconnection,
      options.abortTimeout,
    );

    return result
      .ifRight((response: ApduResponse) => {
        this._logger.debug(formatApduReceivedLog(response));
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
          eventName: SessionEvents.DEVICE_STATE_UPDATE_UNKNOWN,
        });
      });
  }

  public sendCommand<Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
    abortTimeout?: number,
  ): Promise<CommandResult<Response, ErrorStatusCodes>> {
    this._logger.debug(`[sendCommand] ${command.name}`);

    // Bypass intent queue if flag is set
    if (this._bypassIntentQueue) {
      return this._unsafeInternalSendCommand(command, abortTimeout);
    }
    return this._internalSendCommand(command, abortTimeout);
  }

  private _internalSendCommand<Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
    abortTimeout?: number,
  ): Promise<CommandResult<Response, ErrorStatusCodes>> {
    const beforeQueuedTimestamp = Date.now();
    const { observable, cancel } = this._intentQueueService.enqueue({
      type: "send-command",
      execute: () =>
        from(
          (async () => {
            const elapsedTime = Date.now() - beforeQueuedTimestamp;
            const result = await this._unsafeInternalSendCommand(
              command,
              // Subtract the elapsed time to account for the time spent in the queue
              // to sync both observable and transport timeout
              abortTimeout ? abortTimeout - elapsedTime : undefined,
            );
            return result;
          })(),
        ),
    });

    const timeoutObservable = abortTimeout
      ? observable.pipe(
          timeout({
            each: abortTimeout,
            with: () => {
              cancel();
              throw new SendCommandTimeoutError();
            },
          }),
        )
      : observable;

    return lastValueFrom(timeoutObservable);
  }

  private async _unsafeInternalSendCommand<Response, Args, ErrorStatusCodes>(
    command: Command<Response, Args, ErrorStatusCodes>,
    abortTimeout?: number,
  ): Promise<CommandResult<Response, ErrorStatusCodes>> {
    const apdu = command.getApdu();

    const response = await this._unsafeInternalSendApdu(apdu.getRawApdu(), {
      isPolling: false,
      triggersDisconnection: command.triggersDisconnection ?? false,
      abortTimeout,
    });

    return response.caseOf({
      Left: (err) => {
        this._logger.error("[sendCommand] error", { data: { err } });
        throw err;
      },
      Right: (r) => {
        const result = command.parseResponse(
          r,
          this._connectedDevice.deviceModel.id,
        );
        this._logger.debug("[sendCommand] result", { data: { result } });
        return result;
      },
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
    // Bypass intent queue if flag is set
    if (this._bypassIntentQueue) {
      return this._unsafeInternalExecuteDeviceAction(deviceAction);
    }
    return this._internalExecuteDeviceAction(deviceAction);
  }

  private _internalExecuteDeviceAction<
    Output,
    Input,
    E extends DmkError,
    IntermediateValue extends DeviceActionIntermediateValue,
  >(
    deviceAction: DeviceAction<Output, Input, E, IntermediateValue>,
  ): ExecuteDeviceActionReturnType<Output, E, IntermediateValue> {
    let deviceActionCancel: (() => void) | undefined;

    const { observable: o, cancel: queueCancel } =
      this._intentQueueService.enqueue({
        type: "device-action",
        execute: () => {
          const { observable, cancel } =
            this._unsafeInternalExecuteDeviceAction(deviceAction);
          deviceActionCancel = cancel;
          return observable;
        },
      });

    return {
      observable: o,
      cancel: () => {
        deviceActionCancel?.();
        queueCancel();
      },
    };
  }

  private _unsafeInternalExecuteDeviceAction<
    Output,
    Input,
    E extends DmkError,
    IntermediateValue extends DeviceActionIntermediateValue,
  >(
    deviceAction: DeviceAction<Output, Input, E, IntermediateValue>,
  ): ExecuteDeviceActionReturnType<Output, E, IntermediateValue> {
    const { observable, cancel } = deviceAction._execute({
      sendApdu: async (apdu: Uint8Array) => this._unsafeInternalSendApdu(apdu), // note: there is no timeout handled at this stage
      sendCommand: async <Response, ErrorStatusCodes, Args>(
        command: Command<Response, ErrorStatusCodes, Args>,
      ) => this._unsafeInternalSendCommand(command), // note: there is no timeout handled at this stage
      getDeviceModel: () => this._connectedDevice.deviceModel,
      getDeviceSessionState: () => this._deviceState.getValue(),
      getDeviceSessionStateObservable: () => this.state,
      setDeviceSessionState: (state: DeviceSessionState) => {
        this.setDeviceSessionState(state);
        return this._deviceState.getValue();
      },
      getManagerApiService: () => this._managerApiService,
      getSecureChannelService: () => this._secureChannelService,
    });

    return {
      observable,
      cancel,
    };
  }

  public close(): void {
    this._updateDeviceStatus(DeviceStatus.NOT_CONNECTED);
    this._deviceState.complete();
    this._deviceSessionRefresher.stopRefresher();
    this._pinger.unsubscribe();
  }

  public disableRefresher(id: string): () => void {
    return this._refresherService.disableRefresher(id);
  }

  public _unsafeBypassIntentQueue(bypass: boolean): void {
    this._bypassIntentQueue = bypass;
  }

  private _updateDeviceStatus(deviceStatus: DeviceStatus): void {
    const state = this._deviceState.getValue();
    this._deviceState.next({ ...state, deviceStatus });
  }
}
