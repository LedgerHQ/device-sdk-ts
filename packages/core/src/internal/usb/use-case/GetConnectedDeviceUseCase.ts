import { inject, injectable } from "inversify";

import { ConnectedDevice } from "@api/usb/model/ConnectedDevice";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { SessionId } from "@internal/device-session/model/Session";
import type { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type GetConnectedDeviceUseCaseArgs = {
  sessionId: SessionId;
};

/**
 * Get a connected device from session id.
 */
@injectable()
export class GetConnectedDeviceUseCase {
  private readonly _sessionService: SessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.SessionService)
    sessionService: SessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("GetConnectedDeviceUseCase");
  }

  execute({ sessionId }: GetConnectedDeviceUseCaseArgs): ConnectedDevice {
    const deviceSession = this._sessionService.getSessionById(sessionId);

    return deviceSession.caseOf({
      Right: (session) =>
        new ConnectedDevice({
          internalConnectedDevice: session.connectedDevice,
        }),
      Left: (error) => {
        this._logger.error("Error getting session", {
          data: { error },
        });
        throw error;
      },
    });
  }
}
