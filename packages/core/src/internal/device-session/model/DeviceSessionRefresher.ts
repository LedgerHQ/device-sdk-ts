/* eslint @typescript-eslint/no-unsafe-declaration-merging: 0 */
import { Either } from "purify-ts";
import {
  BehaviorSubject,
  filter,
  interval,
  map,
  Subscription,
  switchMap,
} from "rxjs";

import { GetAppAndVersionCommand } from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { SdkError } from "@api/Error";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type DeviceSessionRefresherArgs = {
  /**
   * The refresh interval in milliseconds.
   */
  refreshInterval: number;

  /**
   * The current state of the device session.
   */
  deviceState: BehaviorSubject<DeviceSessionState>;

  /**
   * The function used to send APDU commands to the device.
   * @param rawApdu Uint8Array The raw APDU command.
   */
  sendApduFn: (rawApdu: Uint8Array) => Promise<Either<SdkError, ApduResponse>>;

  /**
   * The function to update the session state.
   * @param sessionState Partial<DeviceSessionState> The new session state.
   */
  updateDeviceSessionState(sessionState: Partial<DeviceSessionState>): void;
};

/**
 * The session refresher that periodically sends a command to refresh the session.
 */
export class DeviceSessionRefresher {
  private readonly _logger: LoggerPublisherService;
  private readonly _getAppAndVersionCommand = new GetAppAndVersionCommand();
  private _subscription: Subscription;

  constructor(
    {
      refreshInterval,
      deviceState,
      sendApduFn,
      updateDeviceSessionState,
    }: DeviceSessionRefresherArgs,
    logger: LoggerPublisherService,
  ) {
    this._logger = logger;
    this._subscription = interval(refreshInterval)
      .pipe(
        filter(
          () =>
            ![DeviceStatus.BUSY, DeviceStatus.NOT_CONNECTED].includes(
              deviceState.getValue().deviceStatus,
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
        updateDeviceSessionState({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: deviceState.getValue().deviceStatus,
          currentApp: parsedResponse.name,
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
