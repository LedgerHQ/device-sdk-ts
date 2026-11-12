import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";

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
  ) {
    this._sessionService = sessionService;
    this._logger = getLogger("GetDeviceSessionStateUseCase");
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
