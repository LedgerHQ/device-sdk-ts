import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

export type GetSessionDeviceStateUseCaseArgs = {
  sessionId: DeviceSessionId;
};

/**
 * Get deviceSession state from its id.
 */
@injectable()
export class GetDeviceSessionStateUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("GetDeviceSessionStateUseCase");
  }

  execute({ sessionId }: GetSessionDeviceStateUseCaseArgs) {
    const errorOrDeviceSession =
      this._sessionService.getDeviceSessionById(sessionId);

    return errorOrDeviceSession.caseOf({
      Left: (error) => {
        this._logger.error("Error getting session device", { data: { error } });
        throw error;
      },
      Right: (deviceSession) => deviceSession.state,
    });
  }
}
