import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

/**
 * List all device sessions.
 */
@injectable()
export class ListDeviceSessionsUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("ListDeviceSessionsUseCase");
  }

  execute(): DeviceSessionId[] {
    this._logger.info("Listing device sessions");
    return this._sessionService
      .getDeviceSessions()
      .map((dSession) => dSession.id);
  }
}
