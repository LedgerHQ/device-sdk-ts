import { inject, injectable } from "inversify";

import { Command } from "@api/command/Command";
import { CommandResult } from "@api/command/model/CommandResult";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export type SendCommandUseCaseArgs<Response, ErrorStatusCodes, Args = void> = {
  /**
   * The device session id.
   */
  readonly sessionId: string;
  /**
   * The command to send.
   */
  readonly command: Command<Response, ErrorStatusCodes, Args>;
};

/**
 * Sends a command to a device through a device session.
 */
@injectable()
export class SendCommandUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("SendCommandUseCase");
  }

  /**
   * Sends a command to a device through a device session.
   *
   * @param sessionId - The device session id.
   * @param command - The command to send.
   * @returns The response from the command.
   */
  async execute<Response, ErrorStatusCodes, Args = void>({
    sessionId,
    command,
  }: SendCommandUseCaseArgs<Response, ErrorStatusCodes, Args>): Promise<
    CommandResult<Response, ErrorStatusCodes>
  > {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionById(sessionId);

    return deviceSessionOrError.caseOf({
      // Case device session found
      Right: async (deviceSession) =>
        await deviceSession.sendCommand<Response, ErrorStatusCodes, Args>(
          command,
        ),
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
