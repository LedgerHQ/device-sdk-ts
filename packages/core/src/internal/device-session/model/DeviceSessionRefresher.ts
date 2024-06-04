import { injectable } from "inversify";
import { Either } from "purify-ts";
import { filter, interval, map, Subscription, switchMap } from "rxjs";

import {
  GetAppAndVersionCommand,
  GetAppAndVersionResponse,
} from "@api/command/os/GetAppAndVersionCommand";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { SdkError } from "@api/Error";
import { ApduResponse, DeviceStatus } from "@api/index";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

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
  sendApduFn: (rawApdu: Uint8Array) => Promise<Either<SdkError, ApduResponse>>;

  /**
   * Callback that updates the state of the device session with
   * polling response.
   * @param state - The new state to update to.
   */
  updateStateFn(state: DeviceSessionState): void;
};

/**
 * The session refresher that periodically sends a command to refresh the session.
 */
@injectable()
export class DeviceSessionRefresher {
  private readonly _logger: LoggerPublisherService;
  private readonly _getAppAndVersionCommand = new GetAppAndVersionCommand();
  private _deviceStatus: DeviceStatus;
  private _subscription: Subscription;

  constructor(
    {
      refreshInterval,
      deviceStatus,
      sendApduFn,
      updateStateFn,
    }: DeviceSessionRefresherArgs,
    logger: LoggerPublisherService,
  ) {
    this._deviceStatus = deviceStatus;
    this._logger = logger;
    this._subscription = interval(refreshInterval)
      .pipe(
        filter(
          () =>
            ![DeviceStatus.BUSY, DeviceStatus.NOT_CONNECTED].includes(
              this._deviceStatus,
            ),
        ),
        switchMap(() => {
          const rawApdu = this._getAppAndVersionCommand.getApdu().getRawApdu();
          return sendApduFn(rawApdu);
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
      )
      .subscribe((parsedResponse: GetAppAndVersionResponse | null) => {
        // batteryStatus and firmwareVersion are not available in the polling response.
        updateStateFn({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: this._deviceStatus,
          currentApp: parsedResponse!.name,
        });
      });
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
  }
}
