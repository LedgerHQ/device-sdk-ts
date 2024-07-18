import { inject, injectable } from "inversify";

import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";

@injectable()
export class CloseSessionsUseCase {
  private readonly _sessionService: DeviceSessionService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
  ) {
    this._sessionService = sessionService;
  }

  execute() {
    const deviceSessions = this._sessionService.getDeviceSessions();

    for (const dSession of deviceSessions) {
      dSession.close();
    }
  }
}
