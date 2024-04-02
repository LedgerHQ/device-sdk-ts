import { inject, injectable } from "inversify";

import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { SessionId } from "@internal/device-session/model/Session";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";

export type GetConnectedDeviceUseCaseArgs = {
  sessionId: SessionId;
};

/**
 * Get a connected device from session id.
 */
@injectable()
export class GetConnectedDeviceUseCase {
  private readonly _sessionService: DefaultSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.SessionService)
    sessionService: DefaultSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("GetConnectedDeviceUseCase");
  }

  execute({ sessionId }: GetConnectedDeviceUseCaseArgs): ConnectedDevice {
    const deviceSession = this._sessionService.getSession(sessionId);

    return deviceSession.caseOf({
      Right: (session) => session.connectedDevice,
      Left: () => {
        this._logger.error("Error getting session", {
          data: { error: deviceSession.extract() },
        });
        throw deviceSession.extract();
      },
    });
  }
}