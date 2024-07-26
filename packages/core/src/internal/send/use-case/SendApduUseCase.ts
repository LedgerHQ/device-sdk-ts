import { inject, injectable } from "inversify";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

/**
 * The arguments for the SendApduUseCase.
 */
export type SendApduUseCaseArgs = {
  /**
   * Device session identifier from `DeviceSdk.connect`.
   */
  sessionId: DeviceSessionId;
  /**
   * Raw APDU to send to the device.
   */
  apdu: Uint8Array;
};

/**
 * Sends an APDU to a connected device.
 */
@injectable()
export class SendApduUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("SendApduUseCase");
  }

  async execute({
    sessionId,
    apdu,
  }: SendApduUseCaseArgs): Promise<ApduResponse> {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionById(sessionId);

    return deviceSessionOrError.caseOf({
      // Case device session found
      Right: async (deviceSession) => {
        const response = await deviceSession.sendApdu(apdu);
        return response.caseOf({
          // Case APDU sent and response received successfully
          Right: (data: ApduResponse) => data,
          // Case error sending or receiving APDU
          Left: (error: SdkError) => {
            this._logger.error("Error sending APDU", {
              data: { sessionId, apdu, error },
            });
            throw error;
          },
        });
      },
      // Case device session not found
      Left: (error) => {
        this._logger.error("Error getting deviceSession", {
          data: { error },
        });
        throw error;
      },
    });
  }
}
