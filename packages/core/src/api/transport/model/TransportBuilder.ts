import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { Transport } from "./Transport";

export interface TransportBuilder<
  T extends Transport,
  Config extends Record<string, unknown> = Record<string, unknown>,
> {
  setLoggerFactory(
    loggerFactory: (name: string) => LoggerPublisherService,
  ): TransportBuilder<T, Config>;
  setDeviceModelDataSource(
    deviceModelDataSource: DeviceModelDataSource,
  ): TransportBuilder<T, Config>;
  setConfig(Config: Config): TransportBuilder<T, Config>;
  build(): T;
}
