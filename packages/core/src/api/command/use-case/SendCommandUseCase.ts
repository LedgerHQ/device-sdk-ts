import { inject, injectable } from "inversify";

import { Command } from "@api/command/Command";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type SendCommandUseCaseArgs<T, U = void> = {
  sessionId: string;
  command: Command<T, U>;
  params: U;
};

/**
 * Sends a command to a device through a device session.
 */
@injectable()
export class SendCommandUseCase {
  private readonly _sessionService: SessionService;
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.SessionService) sessionService: SessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("SendCommandUseCase");
  }

  async execute<T, U = void>({
    sessionId,
    command,
    params,
  }: SendCommandUseCaseArgs<T, U>): Promise<T> {
    const deviceSession = this._sessionService.getSessionById(sessionId);

    return deviceSession.caseOf({
      // Case device session found
      Right: async (session) => {
        const deviceModelId = session.connectedDevice.deviceModel.id;
        const action = session.getCommand<T, U>(command);
        const response = await action(deviceModelId, params);
        return response;
      },
      // Case device session not found
      Left: (error) => {
        this._logger.error("Error getting session", {
          data: { error },
        });
        throw error;
      },
    });
  }
}
