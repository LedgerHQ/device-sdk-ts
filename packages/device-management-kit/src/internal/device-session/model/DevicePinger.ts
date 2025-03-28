import { type Subscription } from "rxjs";

import { DeviceModelId } from "@api/device/DeviceModel";
import {
  GetAppAndVersionCommand,
  type GetAppAndVersionResponse,
  GetOsVersionCommand,
  type TransportConnectedDevice,
} from "@api/index";
import {
  type Command,
  type CommandResult,
  type LoggerPublisherService,
} from "@api/types";
import { DEVICE_SESSION_REFRESHER_POLLING_INTERVAL } from "@internal/device-session/data/DeviceSessionRefresherConst";
import {
  type DeviceSessionEventDispatcher,
  type NewEvent,
  SessionEvents,
} from "@internal/device-session/model/DeviceSessionEventDispatcher";

type SendCommandFunction = <Response, Args, ErrorStatusCodes>(
  command: Command<Response, Args, ErrorStatusCodes>,
) => Promise<CommandResult<Response, ErrorStatusCodes>>;

export class DevicePinger {
  private readonly _sendCommandFunction: SendCommandFunction;
  private _subscription: Subscription;
  private _logger: LoggerPublisherService;

  constructor(
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
    private connectedDevice: TransportConnectedDevice,
    private _sessionEventDispatcher: DeviceSessionEventDispatcher,
    sendCommandFunction: SendCommandFunction,
  ) {
    this._sendCommandFunction = sendCommandFunction;
    this._logger = loggerModuleFactory("device-pinger");
    this._subscription = this._sessionEventDispatcher
      .listen()
      .subscribe(async (event) => await this.mapEventAction(event));
  }

  public async ping(): Promise<CommandResult<GetAppAndVersionResponse> | null> {
    try {
      const result = await this.mapDevicePingAction(
        this.connectedDevice.deviceModel.id,
      );
      return result;
    } catch (error) {
      this._logger.error("Error while pinging device", {
        data: {
          error,
        },
      });
      throw error;
    }
  }

  private mapEventAction = async (event: NewEvent) => {
    switch (event.eventName) {
      case SessionEvents.REFRESH_NEEDED:
        return await this.ping();
      default:
        return null;
    }
  };

  private async mapDevicePingAction(deviceModelId: DeviceModelId) {
    switch (deviceModelId) {
      case DeviceModelId.NANO_S: {
        const chainPromise: Promise<CommandResult<GetAppAndVersionResponse>> =
          (async () => {
            const appVersionResult = await this._sendCommandFunction(
              new GetAppAndVersionCommand(),
            );

            this._sendCommandFunction(new GetOsVersionCommand());
            return appVersionResult;
          })();

        const timeoutPromise: Promise<null> = new Promise((resolve) => {
          setTimeout(
            () => resolve(null),
            DEVICE_SESSION_REFRESHER_POLLING_INTERVAL * 2 + 100,
          );
        });

        const resultOrTimeout: CommandResult<GetAppAndVersionResponse> | null =
          await Promise.race([chainPromise, timeoutPromise]);

        if (!resultOrTimeout) {
          this._sessionEventDispatcher.dispatch({
            eventName: SessionEvents.DEVICE_STATE_UPDATE_LOCKED,
          });
        } else {
          this._sessionEventDispatcher.dispatch({
            eventName: SessionEvents.COMMAND_SUCCEEDED,
            eventData: resultOrTimeout,
          });
        }
        return resultOrTimeout;
      }
      default: {
        const result = await this._sendCommandFunction(
          new GetAppAndVersionCommand(),
        );
        this._sessionEventDispatcher.dispatch({
          eventName: SessionEvents.COMMAND_SUCCEEDED,
          eventData: result,
        });
        return result;
      }
    }
  }

  public unsubscribe(): void {
    this._subscription.unsubscribe();
  }
}
