import { inject, injectable } from "inversify";

import { type DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";

export type DisableDeviceSessionRefresherUseCaseArgs = {
  sessionId: DeviceSessionId;
  blockerId: string;
};

/**
 * Disable the device session refresher.
 */
@injectable()
export class DisableDeviceSessionRefresherUseCase {
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly _sessionService: DeviceSessionService,
  ) {
    this._logger = getLogger("DisableDeviceSessionRefresherUseCase");
  }

  execute({ sessionId, blockerId }: DisableDeviceSessionRefresherUseCaseArgs) {
    const errorOrDeviceSession =
      this._sessionService.getDeviceSessionById(sessionId);

    return errorOrDeviceSession.caseOf({
      Left: (error) => {
        this._logger.error("Error getting device session", { data: { error } });
        throw error;
      },
      // Return a function that can be used to reenable the refresher
      Right: (deviceSession) => deviceSession.disableRefresher(blockerId),
    });
  }
}
