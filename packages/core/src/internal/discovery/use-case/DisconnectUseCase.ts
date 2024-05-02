import { inject, injectable } from "inversify";

import { SessionId } from "@api/session/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

export type DisconnectUseCaseArgs = {
  sessionId: SessionId;
};

/**
 * Disconnects to a discovered device via USB HID (and later BLE).
 */
@injectable()
export class DisconnectUseCase {
  private readonly _usbHidTransport: UsbHidTransport;
  private readonly _sessionService: SessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(usbDiTypes.UsbHidTransport)
    usbHidTransport: UsbHidTransport,
    @inject(deviceSessionTypes.SessionService)
    sessionService: SessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._usbHidTransport = usbHidTransport;
    this._logger = loggerFactory("DisconnectUseCase");
  }

  async execute({ sessionId }: DisconnectUseCaseArgs): Promise<void> {
    const errorOrSession = this._sessionService.getSessionById(sessionId);

    return errorOrSession.caseOf({
      Left: (error) => {
        this._logger.error("Device session not found", {
          data: { sessionId, error },
        });
        throw error;
      },
      Right: async (session) => {
        session.close();

        this._sessionService.removeSession(sessionId);

        await this._usbHidTransport
          .disconnect({
            connectedDevice: session.connectedDevice,
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
