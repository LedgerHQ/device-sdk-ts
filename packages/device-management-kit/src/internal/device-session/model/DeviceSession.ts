import { type Either, Left } from "purify-ts";
import { BehaviorSubject, type Subscription } from "rxjs";
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
import { DeviceBusyError, type DmkError } from "@api/Error";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import { DEVICE_SESSION_REFRESH_INTERVAL } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { RefresherService } from "@internal/device-session/service/RefresherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import { DeviceSessionRefresher } from "./DeviceSessionRefresher";

export type SessionConstructorArgs = {
  connectedDevice: TransportConnectedDevice;
  id?: DeviceSessionId;
};

type SendApduOptions = {
  isPolling?: boolean;
  triggersDisconnection?: boolean;
};

/**
 * Represents a session with a device.
 */
export class DeviceSession {
  private readonly _id: DeviceSessionId;
  private readonly _connectedDevice: TransportConnectedDevice;
  private readonly _deviceState: BehaviorSubject<DeviceSessionState>;
  private readonly _refresher: DeviceSessionRefresher;
  private readonly _refresherService: RefresherService;
  private readonly _managerApiService: ManagerApiService;
  private readonly _secureChannelService: SecureChannelService;
  private readonly _readyPromise: Promise<void>;
  private _resolveReady!: () => void;

  constructor(
    { connectedDevice, id = uuidv4() }: SessionConstructorArgs,
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    managerApiService: ManagerApiService,
    secureChannelService: SecureChannelService,
  ) {
    this._id = id;
    this._connectedDevice = connectedDevice;
    this._deviceState = new BehaviorSubject<DeviceSessionState>({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: this._connectedDevice.deviceModel.id,
    });
    this._refresher = new DeviceSessionRefresher(
      {
        refreshInterval: DEVICE_SESSION_REFRESH_INTERVAL,
        deviceStatus: DeviceStatus.CONNECTED,
        deviceModelId: this._connectedDevice.deviceModel.id,
        sendApduFn: (rawApdu: Uint8Array) =>
          this.sendApdu(rawApdu, {
            isPolling: true,
            triggersDisconnection: false,
          }),
        updateStateFn: (callback) => {
          const state = this._deviceState.getValue();
          this.setDeviceSessionState(callback(state));
        },
      },
      loggerModuleFactory("device-session-refresher"),
    );
    this._refresherService = new RefresherService(this._refresher);
    this._managerApiService = managerApiService;
    this._secureChannelService = secureChannelService;
    this._readyPromise = new Promise<void>((resolve) => {
      this._resolveReady = resolve;
    });
    this._refresher.start();
  }

  public async waitIsReady() {
    await this._readyPromise;
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
    this._resolveReady();
  }

  public async sendApdu(
    rawApdu: Uint8Array,
    options: SendApduOptions = {
      isPolling: false,
      triggersDisconnection: false,
    },
  ): Promise<Either<DmkError, ApduResponse>> {
    let reenableRefresher: () => void;
    if (!options.isPolling) {
      reenableRefresher = this._refresherService.disableRefresher("sendApdu");
      await this.waitUntilReady();
    }

    const sessionState = this._deviceState.getValue();
    if (sessionState.deviceStatus === DeviceStatus.BUSY) {
      return Left(new DeviceBusyError());
    }

    this.updateDeviceStatus(DeviceStatus.BUSY);

    const errorOrResponse = await this._connectedDevice.sendApdu(
      rawApdu,
      options.triggersDisconnection,
    );

    return errorOrResponse
      .ifRight((response: ApduResponse) => {
        if (CommandUtils.isLockedDeviceResponse(response)) {
          this.updateDeviceStatus(DeviceStatus.LOCKED);
        } else {
          this.updateDeviceStatus(DeviceStatus.CONNECTED);
        }

        if (!options.isPolling && reenableRefresher) {
          reenableRefresher();
        }
      })
      .ifLeft(() => {
        this.updateDeviceStatus(DeviceStatus.CONNECTED);

        if (!options.isPolling && reenableRefresher) {
          reenableRefresher();
        }
      });
  }

  public async sendCommand<Response, Args, ErrorStatusCodes>(
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

  public executeDeviceAction<
    Output,
    Input,
    Error extends DmkError,
    IntermediateValue extends DeviceActionIntermediateValue,
  >(
    deviceAction: DeviceAction<Output, Input, Error, IntermediateValue>,
  ): ExecuteDeviceActionReturnType<Output, Error, IntermediateValue> {
    const { observable, cancel } = deviceAction._execute({
      sendApdu: async (apdu: Uint8Array) => this.sendApdu(apdu),
      sendCommand: async <Response, ErrorStatusCodes, Args>(
        command: Command<Response, ErrorStatusCodes, Args>,
      ) => this.sendCommand(command),
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

    return {
      observable,
      cancel,
    };
  }

  public close() {
    this.updateDeviceStatus(DeviceStatus.NOT_CONNECTED);
    this._deviceState.complete();
    this._refresher.stop();
  }

  public disableRefresher(id: string): () => void {
    return this._refresherService.disableRefresher(id);
  }

  private updateDeviceStatus(deviceStatus: DeviceStatus) {
    const sessionState = this._deviceState.getValue();
    this._refresher.setDeviceStatus(deviceStatus);
    this._deviceState.next({
      ...sessionState,
      deviceStatus,
    });
  }

  private async waitUntilReady() {
    let deviceStateSub: Subscription;

    await new Promise<void>((resolve) => {
      deviceStateSub = this._deviceState.subscribe((state) => {
        if (
          [DeviceStatus.LOCKED, DeviceStatus.CONNECTED].includes(
            state.deviceStatus,
          )
        ) {
          deviceStateSub?.unsubscribe();
          resolve();
        }
      });
    });
  }
}
