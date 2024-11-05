import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { TransportNotSupportedError } from "@api/transport/model/Errors";
import type { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { TransportService } from "@internal/transport/service/TransportService";

/**
 * The arguments for the DisconnectUseCase.
 */
export type DisconnectUseCaseArgs = {
  /**
   * Device session identifier from `DeviceManagementKit.connect`.
   */
  sessionId: DeviceSessionId;
};

/**
 * Disconnects to a discovered device.
 */
@injectable()
export class DisconnectUseCase {
  private readonly _transportService: TransportService;
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(transportDiTypes.TransportService)
    transportService: TransportService,
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._transportService = transportService;
    this._logger = loggerFactory("DisconnectUseCase");
  }

  async execute({ sessionId }: DisconnectUseCaseArgs): Promise<void> {
    return EitherAsync(async ({ liftEither }) => {
      const session = await liftEither(
        this._sessionService.getDeviceSessionById(sessionId).ifLeft((error) => {
          this._logger.error("Device session not found", {
            data: { sessionId, error },
          });
        }),
      );

      const transportIdentifier = session.connectedDevice.transport;
      const transport = await liftEither(
        this._transportService
          .getTransport(transportIdentifier)
          .toEither(
            new TransportNotSupportedError(new Error("Unknown transport")),
          ),
      );

      session.close();
      this._sessionService.removeDeviceSession(sessionId);

      await transport.disconnect({
        connectedDevice: session.connectedDevice,
      });
    }).caseOf({
      Left: (error) => {
        this._logger.error("Error disconnecting from device", {
          data: { error },
        });
        throw error;
      },
      Right: () => {},
    });
  }
}
