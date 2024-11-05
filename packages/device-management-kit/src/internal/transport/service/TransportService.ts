import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { type ApduReceiverServiceFactory } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderServiceFactory } from "@api/device-session/service/ApduSenderService";
import { type DmkConfig } from "@api/DmkConfig";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { TransportAlreadyExistsError } from "@api/transport/model/Errors";
import { TransportFactory } from "@api/transport/model/Transport";
import { Transport } from "@api/types";
import { deviceModelTypes } from "@internal/device-model/di/deviceModelTypes";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

@injectable()
export class TransportService {
  private _transports: Map<string, Transport> = new Map();
  private _loggerModuleFactory: (tag: string) => LoggerPublisherService;
  private _logger: LoggerPublisherService;
  private _config: DmkConfig;
  private _deviceModelDataSource: DeviceModelDataSource;
  private _apduSenderServiceFactory: ApduSenderServiceFactory;
  private _apduReceiverServiceFactory: ApduReceiverServiceFactory;

  constructor(
    @inject(transportDiTypes.TransportsInput)
    _transports: TransportFactory[],
    @inject(transportDiTypes.DmkConfig)
    _config: DmkConfig,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    _loggerModuleFactory: (tag: string) => LoggerPublisherService,
    @inject(deviceModelTypes.DeviceModelDataSource)
    _deviceModelDataSource: DeviceModelDataSource,
    @inject(deviceSessionTypes.ApduSenderServiceFactory)
    _apduSenderServiceFactory: ApduSenderServiceFactory,
    @inject(deviceSessionTypes.ApduReceiverServiceFactory)
    _apduReceiverServiceFactory: ApduReceiverServiceFactory,
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

    console.log(`😵 Transports: ${_transports} 🎉`);

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
