import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

import { TransportBuilder } from "@api/transport/model/TransportBuilder";
import { Transport, TransportIdentifier } from "@api/types";
import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { deviceModelTypes } from "@internal/device-model/di/deviceModelTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import {
  TransportDuplicatedError,
  TransportNotSupportedError,
} from "@internal/transport/model/Errors";

import { TransportService } from "./TransportService";

@injectable()
export class DefaultTransportService implements TransportService {
  private readonly _transports: Map<TransportIdentifier, Transport> = new Map();
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    private readonly _loggerModuleFactory: (
      tag: string,
    ) => LoggerPublisherService,
    @inject(deviceModelTypes.DeviceModelDataSource)
    private readonly _deviceModelDataSource: DeviceModelDataSource,
  ) {
    this._logger = this._loggerModuleFactory("DefaultTransportService");
  }
  addTransport<T extends Transport, Config extends Record<string, unknown>>(
    transportBuilder: TransportBuilder<T, Config>,
  ): Either<TransportDuplicatedError, TransportService> {
    const transport = transportBuilder
      .setDeviceModelDataSource(this._deviceModelDataSource)
      .setLoggerFactory(this._loggerModuleFactory)
      .build();
    if (this._transports.has(transport.getIdentifier())) {
      return Left(new TransportDuplicatedError());
    }
    this._transports.set(transport.getIdentifier(), transport);
    return Right(this);
  }

  getTransportById(
    transportId: TransportIdentifier,
  ): Either<TransportNotSupportedError, Transport> {
    this._logger.info("getting transport", {
      data: { transports: this._transports, transportId },
    });
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
