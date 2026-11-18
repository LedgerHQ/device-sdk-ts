import { inject, injectable } from "inversify";
import { map, Observable } from "rxjs";

import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

/**
 * Listen to the list of connected devices
 */
@injectable()
export class ListenToConnectedDevicesUseCase {
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly _sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("ListenToConnectedDevicesUseCase");
  }

  execute(): Observable<ConnectedDevice[]> {
    this._logger.info("Observe the list of connected devices");
    return this._sessionService.sessionListObs.pipe(
      map((deviceSessions) =>
        deviceSessions.map(
          (deviceSession) =>
            new ConnectedDevice({
              transportConnectedDevice: deviceSession.connectedDevice,
              sessionId: deviceSession.id,
            }),
        ),
      ),
    );
  }
}
