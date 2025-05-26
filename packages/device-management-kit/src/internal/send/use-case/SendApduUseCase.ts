import { inject, injectable } from "inversify";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

/**
 * The arguments for the SendApduUseCase.
 */
export type SendApduUseCaseArgs = {
  /**
   * Device session identifier from `DeviceManagementKit.connect`.
   */
  sessionId: DeviceSessionId;
  /**
   * Raw APDU to send to the device.
   */
  apdu: Uint8Array;
  /**
   * The time, in milliseconds, to wait before aborting an operation.
   */
  abortTimeout?: number;
  /**
   * Indicates if a device disconnection should be expected after sending the APDU.
   */
  triggersDisconnection?: boolean;
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
    abortTimeout,
    triggersDisconnection,
  }: SendApduUseCaseArgs): Promise<ApduResponse> {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionById(sessionId);

    return deviceSessionOrError.caseOf({
      // Case device session found
      Right: async (deviceSession) => {
        const response = await deviceSession.sendApdu(apdu, {
          abortTimeout,
          triggersDisconnection,
        });
        return response.caseOf({
          // Case APDU sent and response received successfully
          Right: (data) => data,
          // Case error sending or receiving APDU
          Left: (error) => {
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
