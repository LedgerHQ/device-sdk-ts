import { inject, injectable } from "inversify";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DeviceSessionId, SendApduResult } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { map, Observable } from "rxjs";

/**
 * The arguments for the SendApduUseCase.
 */
export type ExchangeBulkApdusUseCaseArgs = {
  /**
   * Device session identifier from `DeviceManagementKit.connect`.
   */
  sessionId: DeviceSessionId;
  /**
   * Raw APDU to send to the device.
   */
  apdus: Uint8Array[];
};

/**
 * Sends an APDU to a connected device.
 */
@injectable()
export class ExchangeBulkApdusUseCase {
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
    apdus,
  }: ExchangeBulkApdusUseCaseArgs): Promise<
    Observable<{ currentIndex: number } | { result: ApduResponse }>
  > {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionById(sessionId);

    return deviceSessionOrError.caseOf({
      // Case device session found
      Right: async (deviceSession) => {
        const observable = await deviceSession.exchangeBulkApdus(apdus);
        return observable.pipe(
          map(
            (event: { currentIndex: number } | { result: SendApduResult }) => {
              if ("result" in event) {
                const result = event.result;
                return result.caseOf({
                  Left: (error) => {
                    this._logger.error("Error sending APDU", {
                      data: { error },
                    });
                    throw error;
                  },
                  Right: (data) => {
                    return { result: data };
                  },
                });
              } else {
                return event;
              }
            },
          ),
        );
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
