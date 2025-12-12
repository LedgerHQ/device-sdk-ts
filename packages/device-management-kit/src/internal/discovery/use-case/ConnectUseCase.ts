import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { DeviceSessionId } from "@api/device-session/types";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { TransportNotSupportedError } from "@api/transport/model/Errors";
import { DeviceId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import {
  DeviceSession,
  DeviceSessionRefresherOptions,
} from "@internal/device-session/model/DeviceSession";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import type { SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { type TransportService } from "@internal/transport/service/TransportService";

/**
 * The arguments for the ConnectUseCase.
 */
export type ConnectUseCaseArgs = {
  /**
   * Discovered device or connected device.
   */
  device: DiscoveredDevice | ConnectedDevice;

  /**
   * sessionRefresherOptions - optional
   * isRefresherDisabled - whether the refresher is disabled
   * pollingInterval - optional - the refresh interval in milliseconds
   */
  sessionRefresherOptions?: DeviceSessionRefresherOptions;
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
  private readonly _secureChannel: SecureChannelService;
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
    @inject(secureChannelTypes.SecureChannelService)
    secureChannel: SecureChannelService,
  ) {
    this._sessionService = sessionService;
    this._transportService = transportService;
    this._loggerFactory = loggerFactory;
    this._logger = loggerFactory("ConnectUseCase");
    this._managerApi = managerApi;
    this._secureChannel = secureChannel;
  }

  private handleDeviceDisconnect(deviceId: DeviceId) {
    this._sessionService
      .getDeviceSessionsByDeviceId(deviceId)
      .ifRight((deviceSessions) => {
        deviceSessions.forEach((deviceSession) => {
          this._sessionService.removeDeviceSession(deviceSession.id);
          this._logger.info("Session removed", {
            data: { deviceId, sessionId: deviceSession.id },
          });
        });
      });
  }

  async execute({
    device,
    sessionRefresherOptions,
  }: ConnectUseCaseArgs): Promise<DeviceSessionId> {
    const transport = this._transportService.getTransport(device.transport);
    // In case of a connected device, we reconnect using the same session id.
    // If not provided, a new device session id will be generated.
    const deviceSessionId =
      "sessionId" in device ? device.sessionId : undefined;

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
      .ifLeft((_) => {
        this._logger.error("Error connecting to device");
      })
      .map(async (connectedDevice) => {
        const deviceSession = new DeviceSession(
          { connectedDevice, id: deviceSessionId },
          this._loggerFactory,
          this._managerApi,
          this._secureChannel,
          sessionRefresherOptions,
        );
        this._sessionService.addDeviceSession(deviceSession);
        await deviceSession.initialiseSession();
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
