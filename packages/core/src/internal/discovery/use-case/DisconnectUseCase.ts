import { inject, injectable } from "inversify";

import type { DeviceSessionId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

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
 * Disconnects to a discovered device via USB HID (and later BLE).
 */
@injectable()
export class DisconnectUseCase {
  private readonly _usbHidTransport: UsbHidTransport;
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(usbDiTypes.UsbHidTransport)
    usbHidTransport: UsbHidTransport,
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._usbHidTransport = usbHidTransport;
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
        deviceSession.close();

        this._sessionService.removeDeviceSession(sessionId);

        await this._usbHidTransport
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
