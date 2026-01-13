import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { ConnectedDevice } from "@api/index";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DeviceSessionRefresherOptions } from "@internal/device-session/model/DeviceSession";
import { discoveryTypes } from "@internal/discovery/di/discoveryTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

import { ConnectUseCase } from "./ConnectUseCase";
import { DisconnectUseCase } from "./DisconnectUseCase";

/**
 * The arguments for the ReconnectUseCase.
 */
export type ReconnectUseCaseArgs = {
  /**
   * Connected device
   */
  device: ConnectedDevice;

  /**
   * sessionRefresherOptions - optional
   * isRefresherDisabled - whether the refresher is disabled
   * pollingInterval - optional - the refresh interval in milliseconds
   */
  sessionRefresherOptions?: DeviceSessionRefresherOptions;
};

/**
 * Reconnects a device session by disconnecting and reconnecting to the device.
 */
@injectable()
export class ReconnectUseCase {
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(discoveryTypes.ConnectUseCase)
    private readonly connectUseCase: ConnectUseCase,
    @inject(discoveryTypes.DisconnectUseCase)
    private readonly disconnectUseCase: DisconnectUseCase,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("ReconnectUseCase");
  }

  async execute({
    device,
    sessionRefresherOptions,
  }: ReconnectUseCaseArgs): Promise<DeviceSessionId> {
    this._logger.debug("Reconnecting device session", {
      data: { deviceId: device.id, transport: device.transport },
    });
    await this.disconnectUseCase.execute({ sessionId: device.sessionId });

    return this.connectUseCase.execute({
      device,
      sessionRefresherOptions,
    });
  }
}
