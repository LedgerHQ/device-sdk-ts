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

  async execute() {
    const deviceSessions = this._sessionService.getDeviceSessions();

    await this._transportService.closeAllTransports(deviceSessions);
    for (const dSession of deviceSessions) {
      this._sessionService.removeDeviceSession(dSession.id);
    }
  }
}
