import { inject, injectable } from "inversify";
import { map, Observable } from "rxjs";

import { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";

/**
 * Listen to connected devices
 */
@injectable()
export class ListenToConnectedDeviceUseCase {
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly _sessionService: DeviceSessionService,
  ) {
    this._logger = getLogger("ListenToConnectedDeviceUseCase");
  }

  execute(): Observable<ConnectedDevice> {
    this._logger.info("Observe connected devices");
    return this._sessionService.sessionsObs.pipe(
      map(
        (deviceSession) =>
          new ConnectedDevice({
            transportConnectedDevice: deviceSession.connectedDevice,
            sessionId: deviceSession.id,
          }),
      ),
    );
  }
}
