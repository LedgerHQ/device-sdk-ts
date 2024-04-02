import { inject, injectable } from "inversify";

import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";
import { SessionId } from "@internal/device-session/model/Session";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type SendApduUseCaseArgs = {
  sessionId: SessionId;
  apdu: Uint8Array;
};

/**
 * Sends an APDU to a connected device.
 */
@injectable()
export class SendApduUseCase {
  private readonly _sessionService: DefaultSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(deviceSessionTypes.SessionService)
    sessionService: DefaultSessionService,
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
    const deviceSession = this._sessionService.getSession(sessionId);

    return deviceSession.caseOf({
      Right: async (session) => {
        const response = await session.sendApdu(apdu);
        return response.caseOf({
          Right: (data) => {
            this._logger.info("APDU sent", { data: { sessionId, apdu } });
            return data;
          },
          Left: (error) => {
            this._logger.error("Error sending APDU", {
              data: { sessionId, apdu, error },
            });
            throw error;
          },
        });
      },
      Left: () => {
        this._logger.error("Error getting session", {
          data: { error: deviceSession.extract() },
        });
        throw deviceSession.extract();
      },
    });
  }
}
