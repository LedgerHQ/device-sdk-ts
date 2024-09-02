import { injectable } from "inversify";
import { Either } from "purify-ts";
import { filter, interval, map, Subscription, switchMap } from "rxjs";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { GetAppAndVersionCommand } from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { SdkError } from "@api/Error";
import { EventDispatcher } from "@internal/event-dispatcher/service/EventDispatcher";
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
   * The device state EventDispatcher.
   */
  deviceState: EventDispatcher<DeviceSessionState>;

  /**
   * The function used to send APDU commands to the device.
   */
  sendApduFn: (rawApdu: Uint8Array) => Promise<Either<SdkError, ApduResponse>>;
};

/**
 * The session refresher that periodically sends a command to refresh the session.
 */
@injectable()
export class DeviceSessionRefresher {
  private readonly _logger: LoggerPublisherService;
  private readonly _getAppAndVersionCommand = new GetAppAndVersionCommand();
  private _subscription: Subscription;
  private _deviceState: EventDispatcher<DeviceSessionState>;
  constructor(
    { refreshInterval, deviceState, sendApduFn }: DeviceSessionRefresherArgs,
    logger: LoggerPublisherService,
  ) {
    this._deviceState = deviceState;
    this._logger = logger;
    this._subscription = interval(refreshInterval)
      .pipe(
        filter(
          () =>
            ![DeviceStatus.BUSY, DeviceStatus.NOT_CONNECTED].includes(
              this._deviceState.get().deviceStatus,
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
      .subscribe((parsedResponse) => {
        if (!isSuccessCommandResult(parsedResponse)) {
          return;
        }

        this._deviceState.dispatch({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: this._deviceState.get().deviceStatus,
          currentApp: parsedResponse.data.name,
        });
      });
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
