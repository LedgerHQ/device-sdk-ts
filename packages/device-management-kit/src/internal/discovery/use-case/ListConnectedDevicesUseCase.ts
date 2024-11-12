import { inject, injectable } from "inversify";

import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

/**
 * List all connected devices.
 */
@injectable()
export class ListConnectedDevicesUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("ListConnectedDeviceUseCase");
  }

  execute(): ConnectedDevice[] {
    this._logger.info("Listing connected devices");
    return this._sessionService.getDeviceSessions().map(
      (session) =>
        new ConnectedDevice({
          internalConnectedDevice: session.connectedDevice,
          sessionId: session.id,
        }),
    );
  }
}