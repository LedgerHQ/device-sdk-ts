import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { DeviceId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import type { TransportService } from "@internal/transport/service/TransportService";

/**
 * The arguments for the ConnectUseCase.
 */
export type ConnectUseCaseArgs = {
  /**
   * UUID of the device got from device discovery `StartDiscoveringUseCase`
   */
  device: DiscoveredDevice;
};

/**
 * Connects to a discovered device.
 */
@injectable()
export class ConnectUseCase {
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(transportDiTypes.TransportService)
    private readonly _transportService: TransportService,
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly _sessionService: DeviceSessionService,
    @inject(managerApiTypes.ManagerApiService)
    private readonly _managerApi: ManagerApiService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    private readonly _loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = this._loggerFactory("ConnectUseCase");
  }

  private handleDeviceDisconnect(deviceId: DeviceId) {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionByDeviceId(deviceId);
    deviceSessionOrError.map((deviceSession) => {
      this._sessionService.removeDeviceSession(deviceSession.id);
    });
  }

  async execute({ device }: ConnectUseCaseArgs): Promise<DeviceSessionId> {
    const transport = this._transportService
      .getTransportById(device.transport)
      .mapLeft((error) => {
        throw error;
      })
      .extract();
    const either = await transport.connect({
      deviceId: device.id,
      onDisconnect: (dId) => this.handleDeviceDisconnect(dId),
    });

    return either.caseOf({
      Left: (error) => {
        this._logger.error("Error connecting to device", {
          data: { deviceId: device.id, error },
        });
        throw error;
      },
      Right: (connectedDevice) => {
        const deviceSession = new DeviceSession(
          { connectedDevice },
          this._loggerFactory,
          this._managerApi,
        );
        this._sessionService.addDeviceSession(deviceSession);
        return deviceSession.id;
      },
    });
  }
}
