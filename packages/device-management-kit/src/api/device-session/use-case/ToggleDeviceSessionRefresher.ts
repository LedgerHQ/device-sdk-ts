import { inject, injectable } from "inversify";

import { type DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

export type ToggleDeviceSessionRefresherUseCaseArgs = {
  sessionId: DeviceSessionId;
  enabled: boolean;
};

/**
 * Toggle the device session refresher.
 */
@injectable()
export class ToggleDeviceSessionRefresherUseCase {
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly _sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("ToggleDeviceSessionRefresherUseCase");
  }

  execute({ sessionId, enabled }: ToggleDeviceSessionRefresherUseCaseArgs) {
    const errorOrDeviceSession =
      this._sessionService.getDeviceSessionById(sessionId);

    return errorOrDeviceSession.caseOf({
      Left: (error) => {
        this._logger.error("Error getting device session", { data: { error } });
        throw error;
      },
      Right: (deviceSession) => deviceSession.toggleRefresher(enabled),
    });
  }
}
