import { type Subscription, timer } from "rxjs";

import { DeviceModelId } from "@api/device/DeviceModel";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import { type LoggerPublisherService } from "@api/types";
import {
  DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL,
  DEVICE_SESSION_REFRESHER_POLLING_INTERVAL,
} from "@internal/device-session/data/DeviceSessionRefresherConst";
import {
  type DeviceSessionEventDispatcher,
  SessionEvents,
} from "@internal/device-session/model/DeviceSessionEventDispatcher";

export interface DeviceSessionRefresherOptions {
  isRefresherDisabled: boolean;
  pollingInterval?: number;
}

export class DeviceSessionRefresher {
  private _refresherSubscription!: Subscription | undefined;
  private _refresherOptions: DeviceSessionRefresherOptions;
  private readonly _logger: LoggerPublisherService;
  private _connectedDeviceID: DeviceModelId;

  constructor(
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    refresherOptions: DeviceSessionRefresherOptions,
    private _sessionEventDispatcher: DeviceSessionEventDispatcher,
    connectedDevice: TransportConnectedDevice,
  ) {
    this._refresherOptions = refresherOptions;
    this._logger = loggerModuleFactory("device-session-refresher");
    this._connectedDeviceID = connectedDevice.deviceModel.id;
  }

  public startRefresher(): void {
    if (this._refresherOptions.isRefresherDisabled) return;

    const pollingInterval =
      this.getValidPollingInterval(this._refresherOptions, this._logger) * 2;

    this._refresherSubscription = timer(0, pollingInterval).subscribe(() => {
      this._sessionEventDispatcher.dispatch({
        eventName: SessionEvents.REFRESH_NEEDED,
      });
    });
  }

  public stopRefresher(): void {
    if (this._refresherSubscription) {
      this._refresherSubscription.unsubscribe();
      this._refresherSubscription = undefined;
      this._logger.info("Refresher stopped.");
    }
  }

  public restartRefresher(): void {
    this.stopRefresher();
    this.startRefresher();
    this._logger.info("Refresher restarted.");
  }

  public destroy(): void {
    this.stopRefresher();
  }

  private getValidPollingInterval = (
    refresherOptions: DeviceSessionRefresherOptions,
    logger: LoggerPublisherService,
  ): number => {
    const { pollingInterval } = refresherOptions;
    switch (this._connectedDeviceID) {
      case DeviceModelId.NANO_S: {
        const defaultNanoPollingInterval =
          DEVICE_SESSION_REFRESHER_POLLING_INTERVAL * 2;
        if (
          pollingInterval !== undefined &&
          pollingInterval < defaultNanoPollingInterval
        ) {
          logger.warn(
            `Polling interval of ${pollingInterval} is too low, setting to minimum as ${defaultNanoPollingInterval}`,
          );
          return defaultNanoPollingInterval;
        }
        return pollingInterval ?? defaultNanoPollingInterval;
      }
      default:
        if (
          pollingInterval !== undefined &&
          pollingInterval < DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL
        ) {
          logger.warn(
            `Polling interval of ${pollingInterval} is too low, setting to minimum as ${DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL}`,
          );
          return DEVICE_SESSION_REFRESHER_MINIMUM_POLLING_INTERVAL;
        }

        return pollingInterval ?? DEVICE_SESSION_REFRESHER_POLLING_INTERVAL;
    }
  };
}
