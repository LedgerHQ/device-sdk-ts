import { inject, injectable } from "inversify";

import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";

/**
 * Use case to set the firmware distribution salt at runtime. During a
 * progressive OS rollout, users with different salts can see different latest
 * OS versions.
 */
@injectable()
export class SetFirmwareDistributionSaltUseCase {
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly sessionService: DeviceSessionService,
    @inject(managerApiTypes.ManagerApiDataSource)
    private readonly managerApiDataSource: ManagerApiDataSource,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("SetFirmwareDistributionSaltUseCase");
  }

  execute(salt: string) {
    if (salt.trim() === "") {
      this._logger.warn("Ignoring empty firmware distribution salt");
      return;
    }

    const previousSalt =
      this.managerApiDataSource.getFirmwareDistributionSalt();
    if (salt === previousSalt) {
      this._logger.debug("Firmware distribution salt unchanged", {
        data: { salt },
      });
      return;
    }

    // Update the salt first, so that any refetch triggered by the session
    // state changes below already uses it
    this.managerApiDataSource.setFirmwareDistributionSalt(salt);

    // Invalidate the firmware update context, as the latest firmware depends
    // on the salt. The next device action that needs it will fetch it again.
    let invalidatedSessions = 0;
    for (const session of this.sessionService.getDeviceSessions()) {
      const state = session.getDeviceSessionState();
      if (state.sessionStateType !== DeviceSessionStateType.Connected) {
        session.setDeviceSessionState({
          ...state,
          firmwareUpdateContext: undefined,
        });
        invalidatedSessions++;
      }
    }

    this._logger.info("Firmware distribution salt updated", {
      data: { previousSalt, salt, invalidatedSessions },
    });
  }
}
