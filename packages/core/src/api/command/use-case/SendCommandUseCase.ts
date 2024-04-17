import { inject, injectable } from "inversify";

import { Command } from "@api/command/Command";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type SendCommandUseCaseArgs<Params, T> = {
  sessionId: string;
  command: Command<Params, T>;
  params?: Params;
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

  async execute<Params, T>({
    sessionId,
    command,
    params,
  }: SendCommandUseCaseArgs<Params, T>): Promise<T> {
    const deviceSession = this._sessionService.getSessionById(sessionId);

    return deviceSession.caseOf({
      // Case device session found
      Right: async (session) => {
        const action = session.getCommand(command);
        const response = await action(params);
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
