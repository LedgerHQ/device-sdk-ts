import { inject, injectable } from "inversify";

import { DeviceSessionId } from "@api/device-session/types";
import { DeviceId } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

/**
 * The arguments for the ConnectUseCase.
 */
export type ConnectUseCaseArgs = {
  /**
   * UUID of the device got from device discovery `StartDiscoveringUseCase`
   */
  deviceId: DeviceId;
};

/**
 * Connects to a discovered device via USB HID (and later BLE).
 */
@injectable()
export class ConnectUseCase {
  private readonly _usbHidTransport: UsbHidTransport;
  private readonly _sessionService: DeviceSessionService;
  private readonly _loggerFactory: (tag: string) => LoggerPublisherService;
  private readonly _managerApi: ManagerApiService;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(usbDiTypes.UsbHidTransport)
    usbHidTransport: UsbHidTransport,
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(managerApiTypes.ManagerApiService)
    managerApi: ManagerApiService,
  ) {
    this._sessionService = sessionService;
    this._usbHidTransport = usbHidTransport;
    this._loggerFactory = loggerFactory;
    this._logger = loggerFactory("ConnectUseCase");
    this._managerApi = managerApi;
  }

  private handleDeviceDisconnect(deviceId: DeviceId) {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionByDeviceId(deviceId);
    deviceSessionOrError.map((deviceSession) => {
      this._sessionService.removeDeviceSession(deviceSession.id);
    });
  }

  async execute({ deviceId }: ConnectUseCaseArgs): Promise<DeviceSessionId> {
    const either = await this._usbHidTransport.connect({
      deviceId,
      onDisconnect: (dId) => this.handleDeviceDisconnect(dId),
    });

    return either.caseOf({
      Left: (error) => {
        this._logger.error("Error connecting to device", {
          data: { deviceId, error },
        });
        throw error;
      },
      Right: (connectedDevice) => {
        const deviceSession = new DeviceSession(
          { connectedDevice },
          this._loggerFactory,
          this._managerApi,
        );
        this._sessionService.addDeviceSession(deviceSession);
        return deviceSession.id;
      },
    });
  }
}
