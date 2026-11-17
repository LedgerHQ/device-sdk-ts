import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";

export type GetConnectedDeviceUseCaseArgs = {
  sessionId: DeviceSessionId;
};

/**
 * Get a connected device from deviceSession id.
 */
@injectable()
export class GetConnectedDeviceUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
  ) {
    this._sessionService = sessionService;
    this._logger = getLogger("GetConnectedDeviceUseCase");
  }

  execute({ sessionId }: GetConnectedDeviceUseCaseArgs): ConnectedDevice {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionById(sessionId);

    return deviceSessionOrError.caseOf({
      Right: (deviceSession) =>
        new ConnectedDevice({
          sessionId: deviceSession.id,
          transportConnectedDevice: deviceSession.connectedDevice,
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
