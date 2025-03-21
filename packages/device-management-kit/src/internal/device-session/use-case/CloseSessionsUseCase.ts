import { inject, injectable } from "inversify";

import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import type { TransportService } from "@internal/transport/service/TransportService";

@injectable()
export class CloseSessionsUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _transportService: TransportService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(transportDiTypes.TransportService)
    transportService: TransportService,
  ) {
    this._sessionService = sessionService;
    this._transportService = transportService;
  }

  execute() {
    const deviceSessions = this._sessionService.getDeviceSessions();

    for (const dSession of deviceSessions) {
      this._transportService.closeConnection(dSession.connectedDevice);
      this._sessionService.removeDeviceSession(dSession.id);
    }
  }
}
