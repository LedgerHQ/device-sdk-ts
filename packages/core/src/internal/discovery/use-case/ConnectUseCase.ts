import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { TransportNotSupportedError } from "@api/transport/model/Errors";
import { DeviceId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { TransportService } from "@internal/transport/service/TransportService";

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
  private readonly _transportService: TransportService;
  private readonly _sessionService: DeviceSessionService;
  private readonly _loggerFactory: (tag: string) => LoggerPublisherService;
  private readonly _managerApi: ManagerApiService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(transportDiTypes.TransportService)
    transportService: TransportService,
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(managerApiTypes.ManagerApiService)
    managerApi: ManagerApiService,
  ) {
    this._sessionService = sessionService;
    this._transportService = transportService;
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
    const transport = this._transportService.getTransport(device.transport);

    return EitherAsync.liftEither(
      transport.toEither(
        new TransportNotSupportedError(new Error("Unknown transport")),
      ),
    )
      .chain(async (t) => {
        return t.connect({
          deviceId: device.id,
          onDisconnect: (dId) => this.handleDeviceDisconnect(dId),
        });
      })
      .ifLeft((error) => {
        this._logger.error("Error connecting to device", {
          data: { deviceId: device.id, error },
        });
      })
      .map((connectedDevice) => {
        const deviceSession = new DeviceSession(
          { connectedDevice },
          this._loggerFactory,
          this._managerApi,
        );
        this._sessionService.addDeviceSession(deviceSession);
        return deviceSession.id;
      })
      .caseOf({
        Left: (error) => {
          throw error;
        },
        Right: (s) => s,
      });
  }
}
