import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import type { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import type { TransportService } from "@internal/transport/service/TransportService";

/**
 * The arguments for the DisconnectUseCase.
 */
export type DisconnectUseCaseArgs = {
  /**
   * Device session identifier from `DeviceSdk.connect`.
   */
  sessionId: DeviceSessionId;
};

/**
 * Disconnects to a discovered device.
 */
@injectable()
export class DisconnectUseCase {
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(transportDiTypes.TransportService)
    private readonly _transportService: TransportService,
    @inject(deviceSessionTypes.DeviceSessionService)
    private readonly _sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("DisconnectUseCase");
  }

  async execute({ sessionId }: DisconnectUseCaseArgs): Promise<void> {
    await EitherAsync(async ({ liftEither, fromPromise }) => {
      const deviceSession = await liftEither(
        this._sessionService
          .getDeviceSessionById(sessionId)
          .mapLeft((error) => {
            this._logger.error("Device session not found", {
              data: { sessionId, error },
            });
          }),
      );
      const transportIdentifier = deviceSession.connectedDevice.transport;
      const transport = await liftEither(
        this._transportService.getTransportById(transportIdentifier),
      );
      deviceSession.close();
      this._sessionService.removeDeviceSession(sessionId);
      await fromPromise(
        transport.disconnect({
          connectedDevice: deviceSession.connectedDevice,
        }),
      );
    });
  }
}
