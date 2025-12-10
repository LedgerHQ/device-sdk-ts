import { inject, injectable } from "inversify";

import { type DeviceSessionId } from "@api/device-session/types";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

export type UnsafeBypassIntentQueueUseCaseArgs = {
  sessionId: DeviceSessionId;
  bypass: boolean;
};

/**
 * UNSAFE: Bypasses the intent queue for a device session.
 * This allows intents to execute directly without being queued.
 * Use with caution as this can lead to race conditions.
 */
@injectable()
export class UnsafeBypassIntentQueueUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("UnsafeBypassIntentQueueUseCase");
  }

  execute({ sessionId, bypass }: UnsafeBypassIntentQueueUseCaseArgs): void {
    const errorOrDeviceSession =
      this._sessionService.getDeviceSessionById(sessionId);

    errorOrDeviceSession.caseOf({
      Left: (error) => {
        this._logger.error("Error getting session", { data: { error } });
        throw error;
      },
      Right: (deviceSession) => {
        this._logger.warn(
          `UNSAFE: ${bypass ? "Enabling" : "Disabling"} intent queue bypass for session ${sessionId}`,
        );
        deviceSession._unsafeBypassIntentQueue(bypass);
      },
    });
  }
}
