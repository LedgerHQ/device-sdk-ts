import { inject, injectable } from "inversify";

import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";

/**
 * Use case to set the provider for the Manager API, this is used to set the
 * provider for the Manager API data source at runtime.
 */
@injectable()
export class SetProviderUseCase {
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly sessionService: DeviceSessionService,
    @inject(managerApiTypes.ManagerApiDataSource)
    private readonly managerApiDataSource: ManagerApiDataSource,
  ) {}

  execute(provider: number) {
    // Invalidate device session state fields that are dependent on the provider
    for (const session of this.sessionService.getDeviceSessions()) {
      const state = session.getDeviceSessionState();
      if (state.sessionStateType !== DeviceSessionStateType.Connected) {
        session.setDeviceSessionState({
          ...state,
          firmwareUpdateContext: undefined,
          installedApps: [],
          appsUpdates: undefined,
          catalog: undefined,
        });
      }
    }

    // Update the provider in the manager API
    this.managerApiDataSource.setProvider(provider);
  }
}
