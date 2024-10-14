import { inject, injectable, multiInject } from "inversify";

import type { Transport } from "@api/transport/model/Transport";
import type { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { TransportNotSupportedError } from "@internal/transport/model/Errors";

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
  private readonly _transports: Transport[];
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @multiInject(transportDiTypes.Transport)
    transports: Transport[],
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._transports = transports;
    this._logger = loggerFactory("DisconnectUseCase");
  }

  async execute({ sessionId }: DisconnectUseCaseArgs): Promise<void> {
    const errorOrSession = this._sessionService.getDeviceSessionById(sessionId);

    return errorOrSession.caseOf({
      Left: (error) => {
        this._logger.error("Device session not found", {
          data: { sessionId, error },
        });
        throw error;
      },
      Right: async (deviceSession) => {
        const transportIdentifier = deviceSession.connectedDevice.transport;
        const transport = this._transports.find(
          (t) => t.getIdentifier() === transportIdentifier,
        );
        if (!transport) {
          throw new TransportNotSupportedError(new Error("Unknown transport"));
        }

        deviceSession.close();
        this._sessionService.removeDeviceSession(sessionId);
        await transport
          .disconnect({
            connectedDevice: deviceSession.connectedDevice,
          })
          .then((errorOrDisconnected) =>
            errorOrDisconnected.mapLeft((error) => {
              throw error;
            }),
          );
      },
    });
  }
}
