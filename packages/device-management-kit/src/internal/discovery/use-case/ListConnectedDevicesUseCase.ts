import { inject, injectable } from "inversify";

import { type LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";

/**
 * List all connected devices.
 */
@injectable()
export class ListConnectedDevicesUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
  ) {
    this._sessionService = sessionService;
    this._logger = getLogger("ListConnectedDeviceUseCase");
  }

  execute(): ConnectedDevice[] {
    this._logger.info("Listing connected devices");
    return this._sessionService.getDeviceSessions().map(
      (session) =>
        new ConnectedDevice({
          transportConnectedDevice: session.connectedDevice,
          sessionId: session.id,
        }),
    );
  }
}
