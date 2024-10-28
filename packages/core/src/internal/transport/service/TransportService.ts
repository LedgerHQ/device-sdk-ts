import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { deviceModelTypes } from "@api/device-model/di/deviceModelTypes";
import {
  ApduReceiverConstructorArgs,
  ApduReceiverService,
} from "@api/device-session/service/ApduReceiverService";
import {
  ApduSenderService,
  ApduSenderServiceConstructorArgs,
} from "@api/device-session/service/ApduSenderService";
import { type SdkConfig } from "@api/SdkConfig";
import { TransportAlreadyExistsError } from "@api/transport/model/Errors";
import { TransportFactory } from "@api/transport/model/Transport";
import { Transport } from "@api/types";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

@injectable()
export class TransportService {
  private _transports: Map<string, Transport> = new Map();
  private _loggerModuleFactory: (tag: string) => LoggerPublisherService;
  private _logger: LoggerPublisherService;
  private _config: SdkConfig;
  private _deviceModelDataSource: DeviceModelDataSource;
  private _apduSenderServiceFactory: (
    args: ApduSenderServiceConstructorArgs,
  ) => ApduSenderService;
  private _apduReceiverServiceFactory: (
    args: ApduReceiverConstructorArgs,
  ) => ApduReceiverService;

  constructor(
    @inject(transportDiTypes.TransportsInput)
    _transports: TransportFactory[],
    @inject(transportDiTypes.SdkConfig)
    _config: SdkConfig,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    _loggerModuleFactory: (tag: string) => LoggerPublisherService,
    @inject(deviceModelTypes.DeviceModelDataSource)
    _deviceModelDataSource: DeviceModelDataSource,
    @inject(deviceSessionTypes.ApduSenderServiceFactory)
    _apduSenderServiceFactory: (
      args: ApduSenderServiceConstructorArgs,
    ) => ApduSenderService,
    @inject(deviceSessionTypes.ApduReceiverServiceFactory)
    _apduReceiverServiceFactory: (
      args: ApduReceiverConstructorArgs,
    ) => ApduReceiverService,
  ) {
    this._logger = _loggerModuleFactory("TransportService");

    if (_transports.length === 0) {
      // TODO: Handle throwing error here
      this._logger.warn(
        "No transports provided, please check your configuration",
      );
    }

    this._loggerModuleFactory = _loggerModuleFactory;
    this._config = _config;
    this._deviceModelDataSource = _deviceModelDataSource;
    this._apduSenderServiceFactory = _apduSenderServiceFactory;
    this._apduReceiverServiceFactory = _apduReceiverServiceFactory;

    for (const transport of _transports) {
      this.addTransport(transport);
    }
  }

  addTransport(factory: TransportFactory) {
    const transport = factory({
      deviceModelDataSource: this._deviceModelDataSource,
      loggerServiceFactory: this._loggerModuleFactory,
      config: this._config,
      apduSenderServiceFactory: this._apduSenderServiceFactory,
      apduReceiverServiceFactory: this._apduReceiverServiceFactory,
    });

    this.addTransportInternal(transport);
  }

  private addTransportInternal(transport: Transport) {
    const MaybeTransport = this.getTransport(transport.getIdentifier());

    if (MaybeTransport.isJust()) {
      this._logger.warn(
        `Transport ${transport.getIdentifier()} already exists, please check your configuration`,
      );

      throw new TransportAlreadyExistsError(
        `Transport ${transport.getIdentifier()} already exists, please check your configuration`,
      );
    }

    this._transports.set(transport.getIdentifier(), transport);
  }

  getTransport(identifier?: string): Maybe<Transport> {
    return Maybe.fromNullable(
      identifier ? this._transports.get(identifier) : undefined,
    );
  }

  getAllTransports(): Transport[] {
    return Array.from(this._transports.values());
  }
}
