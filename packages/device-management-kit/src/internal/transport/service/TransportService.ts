import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { type ApduReceiverServiceFactory } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderServiceFactory } from "@api/device-session/service/ApduSenderService";
import { type DmkConfig } from "@api/DmkConfig";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import {
  NoTransportProvidedError,
  TransportAlreadyExistsError,
} from "@api/transport/model/Errors";
import { TransportFactory } from "@api/transport/model/Transport";
import { Transport } from "@api/types";
import { deviceModelTypes } from "@internal/device-model/di/deviceModelTypes";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

@injectable()
export class TransportService {
  private _transports: Map<string, Transport> = new Map();
  private _logger: LoggerPublisherService;

  constructor(
    @inject(transportDiTypes.TransportsInput)
    _transports: TransportFactory[],
    @inject(transportDiTypes.DmkConfig)
    private readonly _config: DmkConfig,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    private readonly _loggerModuleFactory: (
      tag: string,
    ) => LoggerPublisherService,
    @inject(deviceModelTypes.DeviceModelDataSource)
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    @inject(deviceSessionTypes.ApduSenderServiceFactory)
    private readonly _apduSenderServiceFactory: ApduSenderServiceFactory,
    @inject(deviceSessionTypes.ApduReceiverServiceFactory)
    private readonly _apduReceiverServiceFactory: ApduReceiverServiceFactory,
  ) {
    this._logger = _loggerModuleFactory("TransportService");

    if (_transports.length === 0) {
      this._logger.warn(
        "No transports provided, please check your configuration",
      );

      throw new NoTransportProvidedError(
        "No transports provided, please check your configuration",
      );
    }

    for (const transport of _transports) {
      const either = this.addTransport(transport);

      if (either.isLeft()) {
        throw either.extract();
      }
    }
  }

  addTransport(
    factory: TransportFactory,
  ): Either<TransportAlreadyExistsError, void> {
    const transport = factory({
      deviceModelDataSource: this._deviceModelDataSource,
      loggerServiceFactory: this._loggerModuleFactory,
      config: this._config,
      apduSenderServiceFactory: this._apduSenderServiceFactory,
      apduReceiverServiceFactory: this._apduReceiverServiceFactory,
    });

    return this.addTransportInternal(transport);
  }

  private addTransportInternal(
    transport: Transport,
  ): Either<TransportAlreadyExistsError, void> {
    const MaybeTransport = this.getTransport(transport.getIdentifier());

    if (MaybeTransport.isJust()) {
      this._logger.warn(
        `Transport ${transport.getIdentifier()} already exists, please check your configuration`,
      );

      return Left(
        new TransportAlreadyExistsError(
          `Transport ${transport.getIdentifier()} already exists, please check your configuration`,
        ),
      );
    }

    this._transports.set(transport.getIdentifier(), transport);
    return Right(undefined);
  }

  getTransport(identifier: string): Maybe<Transport> {
    return Maybe.fromNullable(this._transports.get(identifier));
  }

  getAllTransports(): Transport[] {
    return Array.from(this._transports.values());
  }
}
