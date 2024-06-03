import { inject, injectable, multiInject } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import type { Transport } from "@api/transport/model/Transport";
import { DeviceId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { TransportNotSupportedError } from "@internal/transport/model/Errors";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

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
  private readonly _transports: Transport[];
  private readonly _sessionService: DeviceSessionService;
  private readonly _loggerFactory: (tag: string) => LoggerPublisherService;
  private readonly _managerApi: ManagerApiService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @multiInject(transportDiTypes.Transport)
    transports: Transport[],
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(managerApiTypes.ManagerApiService)
    managerApi: ManagerApiService,
  ) {
    this._sessionService = sessionService;
    this._transports = transports;
    this._loggerFactory = loggerFactory;
    this._logger = loggerFactory("ConnectUseCase");
    this._managerApi = managerApi;
  }

  private handleDeviceDisconnect(deviceId: DeviceId) {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionByDeviceId(deviceId);
    deviceSessionOrError.map((deviceSession) => {
      this._sessionService.removeDeviceSession(deviceSession.id);
    });
  }

  async execute({ device }: ConnectUseCaseArgs): Promise<DeviceSessionId> {
    const transport = this._transports.find(
      (t) => t.getIdentifier() === device.transport,
    );
    if (!transport) {
      throw new TransportNotSupportedError(new Error("Unknown transport"));
    }
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
