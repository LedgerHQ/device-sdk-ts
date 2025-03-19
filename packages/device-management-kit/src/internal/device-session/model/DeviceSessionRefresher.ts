import { injectable } from "inversify";
import { Either } from "purify-ts";
import {
  delay,
  filter,
  from,
  iif,
  map,
  Observable,
  of,
  race,
  Subscription,
  switchMap,
  take,
  timer,
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
import {
  DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL,
  DEVICE_SESSION_REFRESHER_POLLING_INTERVAL,
} from "@internal/device-session/data/DeviceSessionRefresherConst";

type UpdateStateFnType = (
  callback: (state: DeviceSessionState) => DeviceSessionState,
) => void;

/**
 * The arguments for the DeviceSessionRefresher.
 */
export type DeviceSessionRefresherArgs = {
  /**
   * Whether the refresher is disabled.
   */
  isRefresherDisabled: boolean;

  /**
   * The refresh interval in milliseconds.
   */
  pollingInterval: number;

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
  private readonly _isRefresherDisabled: boolean;
  private readonly _refreshInterval: number;
  private readonly _deviceModelId: DeviceModelId;
  private readonly _sendApduFn: SendApduFnType;
  private readonly _updateStateFn: UpdateStateFnType;

  constructor(
    {
      isRefresherDisabled,
      pollingInterval,
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
    this._isRefresherDisabled = isRefresherDisabled;
    this._refreshInterval =
      pollingInterval < DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL
        ? DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL
        : pollingInterval;
    this._deviceModelId = deviceModelId;
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
        : this._getDefaultRefreshObservable(timer(0, this._refreshInterval));

    this._subscription = iif(
      () => this._isRefresherDisabled,
      refreshObservable.pipe(take(1)), // if _isRefresherDisabled is true, apply take(1)
      refreshObservable, // otherwise, use the original observable
    ).subscribe((parsedResponse) => {
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
        isSecureConnectionAllowed:
          "isSecureConnectionAllowed" in state
            ? state.isSecureConnectionAllowed
            : false,
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
   * @param {number} pollingInterval - The interval, in milliseconds, at which the NanoS state should be refreshed.
   * @return {Observable<GetAppAndVersionCommandResult | void>} An observable that emits events to refresh the NanoS device state and handle timeout scenarios.
   */
  private _getNanoSRefreshObservable(
    pollingInterval: number,
  ): Observable<GetAppAndVersionCommandResult | void> {
    const nanoSRefreshObservable = this._getDefaultRefreshObservable().pipe(
      switchMap(async (resp) => {
        const rawApdu = this._getOsVersionCommand.getApdu().getRawApdu();
        await this._sendApduFn(rawApdu);
        return resp;
      }),
    );
    const timeoutObservable = of(null).pipe(
      delay(pollingInterval),
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
    return timer(0, pollingInterval + 100).pipe(
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
