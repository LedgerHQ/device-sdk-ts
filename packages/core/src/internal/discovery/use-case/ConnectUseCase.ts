import { inject, injectable } from "inversify";

import { DeviceId } from "@api/device/DeviceModel";
import { SessionId } from "@api/session/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { Session } from "@internal/device-session/model/Session";
import type { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

export type ConnectUseCaseArgs = {
  deviceId: DeviceId;
};

/**
 * Connects to a discovered device via USB HID (and later BLE).
 */
@injectable()
export class ConnectUseCase {
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
    this._logger = loggerFactory("ConnectUseCase");
  }

  async execute({ deviceId }: ConnectUseCaseArgs): Promise<SessionId> {
    const either = await this._usbHidTransport.connect({ deviceId });

    return either.caseOf({
      Left: (error) => {
        this._logger.error("Error connecting to device", {
          data: { deviceId, error },
        });
        throw error;
      },
      Right: (connectedDevice) => {
        const session = new Session({ connectedDevice });
        this._sessionService.addSession(session);
        return session.id;
      },
    });
  }
}
