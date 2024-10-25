import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

import { Transport, TransportIdentifier } from "@api/types";
import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { deviceModelTypes } from "@internal/device-model/di/deviceModelTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { bleDiTypes } from "@internal/transport/ble/di/bleDiTypes";
import { BleDeviceConnectionFactory } from "@internal/transport/ble/service/BleDeviceConnectionFactory";
import {
  TransportDuplicatedError,
  TransportNotSupportedError,
} from "@internal/transport/model/Errors";
import { usbDiTypes } from "@internal/transport/usb/di/usbDiTypes";
import { UsbHidDeviceConnectionFactory } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory";
import { WebUsbHidTransport } from "@internal/transport/usb/transport/__mocks__/WebUsbHidTransport";
import { WebBleTransport } from "@root/src";

import { TransportService } from "./TransportService";

@injectable()
export class DefaultTransportService implements TransportService {
  private readonly _transports: Map<TransportIdentifier, Transport> = new Map();
  private readonly _logger: LoggerPublisherService;
  // @todo externalize those factories in transport packages
  private readonly _deviceConnectionFactoryMap: Map<
    string,
    BleDeviceConnectionFactory | UsbHidDeviceConnectionFactory
  > = new Map();

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    private readonly _loggerModuleFactory: (
      tag: string,
    ) => LoggerPublisherService,
    @inject(deviceModelTypes.DeviceModelDataSource)
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    @inject(usbDiTypes.UsbHidDeviceConnectionFactory)
    usbHidDeviceConnectionFactory: UsbHidDeviceConnectionFactory,
    @inject(bleDiTypes.BleDeviceConnectionFactory)
    bleDeviceConnectionFactory: BleDeviceConnectionFactory,
  ) {
    this._logger = this._loggerModuleFactory("DefaultTransportService");
    this._deviceConnectionFactoryMap.set(
      WebUsbHidTransport.name,
      usbHidDeviceConnectionFactory,
    );
    this._deviceConnectionFactoryMap.set(
      WebBleTransport.name,
      bleDeviceConnectionFactory,
    );
  }
  addTransport(
    transport: Transport,
  ): Either<TransportDuplicatedError, TransportService> {
    if (this._transports.has(transport.getIdentifier())) {
      return Left(new TransportDuplicatedError());
    }
    transport.setLogger(this._loggerModuleFactory(transport.constructor.name));
    transport.setDeviceModelDataSource(this._deviceModelDataSource);
    transport.setDeviceConnectionFactory(
      this._deviceConnectionFactoryMap.get(transport.constructor.name),
    );
    this._transports.set(transport.getIdentifier(), transport);
    return Right(this);
  }

  getTransportById(
    transportId: TransportIdentifier,
  ): Either<TransportNotSupportedError, Transport> {
    return Maybe.fromNullable(this._transports.get(transportId)).toEither(
      new TransportNotSupportedError("Transport id not found"),
    );
  }
  removeTransport(transportId: TransportIdentifier): TransportService {
    if (!this._transports.delete(transportId)) {
      this._logger.error("Transport not found");
    }
    return this;
  }
  getTransports(): ReadonlyArray<Transport> {
    return this._transports.values().toArray();
  }
}
