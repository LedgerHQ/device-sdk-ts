import { inject, injectable } from "inversify";

import { SessionId } from "@api/session/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type GetSessionDeviceStateUseCaseArgs = {
  sessionId: SessionId;
};

/**
 * Get session state from its id.
 */
@injectable()
export class GetSessionDeviceStateUseCase {
  private readonly _sessionService: SessionService;
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.SessionService) sessionService: SessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("GetSessionDeviceStateUseCase");
  }

  execute({ sessionId }: GetSessionDeviceStateUseCaseArgs) {
    const errorOrDeviceSession = this._sessionService.getSessionById(sessionId);

    return errorOrDeviceSession.caseOf({
      Left: (error) => {
        this._logger.error("Error getting session device", { data: { error } });
        throw error;
      },
      Right: (deviceSession) => deviceSession.state,
    });
  }
}
