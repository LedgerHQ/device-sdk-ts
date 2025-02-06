import { injectable } from "inversify";
import { Either } from "purify-ts";
import {
  delay,
  filter,
  from,
  interval,
  map,
  Observable,
  of,
  race,
  Subscription,
  switchMap,
} from "rxjs";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  GetAppAndVersionCommandResult,
} from "@api/command/os/GetAppAndVersionCommand";
import { GetOsVersionCommand } from "@api/command/os/GetOsVersionCommand";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { DmkError } from "@api/Error";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { SendApduFnType } from "@api/transport/model/DeviceConnection";

type UpdateStateFnType = (
  callback: (state: DeviceSessionState) => DeviceSessionState,
) => void;

/**
 * The arguments for the DeviceSessionRefresher.
 */
export type DeviceSessionRefresherArgs = {
  /**
   * The refresh interval in milliseconds.
   */
  refreshInterval: number;

  /**
   * The current device status when the refresher is created.
   */
  deviceStatus: Exclude<DeviceStatus, DeviceStatus.NOT_CONNECTED>;

  /**
   * The function used to send APDU commands to the device.
   */
  sendApduFn: (rawApdu: Uint8Array) => Promise<Either<DmkError, ApduResponse>>;

  /**
   * Callback that updates the state of the device session with
   * polling response.
   * @param callback - A function that will take the previous state and return the new state.
   * @returns void
   */
  updateStateFn: UpdateStateFnType;

  /**
   * Device model to handle NanoS specific refresher
   */
  deviceModelId: DeviceModelId;
};

/**
 * The session refresher that periodically sends a command to refresh the session.
 */
@injectable()
export class DeviceSessionRefresher {
  private readonly _logger: LoggerPublisherService;
  private readonly _getAppAndVersionCommand = new GetAppAndVersionCommand();
  private readonly _getOsVersionCommand = new GetOsVersionCommand();
  private _deviceStatus: DeviceStatus;
  private _subscription?: Subscription;
  private readonly _refreshInterval: number;
  private readonly _deviceModelId: DeviceModelId;
  private readonly _sendApduFn: SendApduFnType;
  private readonly _updateStateFn: UpdateStateFnType;

  constructor(
    {
      refreshInterval,
      deviceStatus,
      sendApduFn,
      updateStateFn,
      deviceModelId,
    }: DeviceSessionRefresherArgs,
    logger: LoggerPublisherService,
  ) {
    this._deviceStatus = deviceStatus;
    this._logger = logger;
    this._sendApduFn = sendApduFn;
    this._updateStateFn = updateStateFn;
    this._refreshInterval = refreshInterval;
    this._deviceModelId = deviceModelId;

    this.start();
  }

  /**
   * Start the session refresher.
   * The refresher will send commands to refresh the session.
   */
  start() {
    if (this._subscription && !this._subscription.closed) {
      this._logger.warn("Refresher already started");
      return;
    }

    // NanoS has a specific refresher that sends GetAppAndVersion and GetOsVersion commands
    const refreshObservable =
      this._deviceModelId === DeviceModelId.NANO_S
        ? this._getNanoSRefreshObservable(this._refreshInterval * 2)
        : this._getDefaultRefreshObservable(interval(this._refreshInterval));

    this._subscription = refreshObservable.subscribe((parsedResponse) => {
      if (!parsedResponse || !isSuccessCommandResult(parsedResponse)) {
        return;
      }
      // `batteryStatus` and `firmwareVersion` are not available in the polling response.
      this._updateStateFn((state) => ({
        ...state,
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: this._deviceStatus,
        currentApp: parsedResponse.data,
        installedApps: "installedApps" in state ? state.installedApps : [],
      }));
    });
  }

  /**
   * Creates an observable that refreshes a device state with GetAppAndVersion command result.
   *
   * @param {ObservableInput<number>} parentObservable - The parent observable to base the refresh observable on. Defaults to an array with a single number [0].
   * @return {Observable<GetAppAndVersionCommandResult>} An observable that emits the result of the GetAppAndVersionCommand.
   */
  private _getDefaultRefreshObservable(
    parentObservable: Observable<number> = from([0]),
  ): Observable<GetAppAndVersionCommandResult> {
    return parentObservable.pipe(
      filter(
        () =>
          ![DeviceStatus.BUSY, DeviceStatus.NOT_CONNECTED].includes(
            this._deviceStatus,
          ),
      ),
      switchMap(async () => {
        const rawApdu = this._getAppAndVersionCommand.getApdu().getRawApdu();
        console.log("Refresher sending getAppAndVersion", rawApdu);
        return await this._sendApduFn(rawApdu);
      }),
      map((resp) =>
        resp.caseOf({
          Left: (error) => {
            this._logger.error("Error in sending APDU when polling", {
              data: { error },
            });
            return null;
          },
          Right: (data: ApduResponse) => {
            try {
              return this._getAppAndVersionCommand.parseResponse(data);
            } catch (error) {
              this._logger.error("Error in parsing APDU response", {
                data: { error },
              });
              return null;
            }
          },
        }),
      ),
      filter((parsedResponse) => parsedResponse !== null),
    );
  }

  /**
   * Creates an observable that emits events to refresh the NanoS device state.
   *
   * @param {number} refreshInterval - The interval, in milliseconds, at which the NanoS state should be refreshed.
   * @return {Observable<GetAppAndVersionCommandResult | void>} An observable that emits events to refresh the NanoS device state and handle timeout scenarios.
   */
  private _getNanoSRefreshObservable(
    refreshInterval: number,
  ): Observable<GetAppAndVersionCommandResult | void> {
    const nanoSRefreshObservable = this._getDefaultRefreshObservable().pipe(
      switchMap(async (resp) => {
        const rawApdu = this._getOsVersionCommand.getApdu().getRawApdu();
        await this._sendApduFn(rawApdu);
        return resp;
      }),
    );
    const timeoutObservable = of(null).pipe(
      delay(refreshInterval),
      map((_) => {
        this._logger.warn(
          "Nanos refresh timeout, setting device status to LOCKED",
        );
        this._updateStateFn((state) => ({
          ...state,
          deviceStatus: DeviceStatus.LOCKED,
        }));
      }),
    );
    return interval(refreshInterval + 100).pipe(
      switchMap(() => race(nanoSRefreshObservable, timeoutObservable)),
    );
  }

  /**
   * Maintain a device status to prevent sending APDU when the device is busy.
   *
   * @param {DeviceStatus} deviceStatus - The new device status.
   */
  setDeviceStatus(deviceStatus: DeviceStatus) {
    if (deviceStatus === DeviceStatus.NOT_CONNECTED) {
      this.stop();
    }
    this._deviceStatus = deviceStatus;
  }

  /**
   * Stops the session refresher.
   * The refresher will no longer send commands to refresh the session.
   */
  stop() {
    if (!this._subscription || this._subscription.closed) {
      return;
    }
    this._subscription.unsubscribe();
    this._subscription = undefined;
  }
}
