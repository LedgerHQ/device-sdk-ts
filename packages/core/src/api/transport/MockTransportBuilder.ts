import { TransportInitializationError } from "@api/Error";
import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { MockTransport } from "@internal/transport/mockserver/MockserverTransport";

import { TransportBuilder } from "./model/TransportBuilder";

type MockTransportBuilderConfig = {
  mockUrl: string;
};

export class MockTransportBuilder
  implements TransportBuilder<MockTransport, MockTransportBuilderConfig>
{
  private _config?: MockTransportBuilderConfig;
  private _loggerFactory?: (name: string) => LoggerPublisherService;
  setConfig(
    config: MockTransportBuilderConfig,
  ): TransportBuilder<MockTransport> {
    this._config = config;
    return this;
  }
  setDeviceModelDataSource(
    _deviceModelDataSource: DeviceModelDataSource,
  ): TransportBuilder<MockTransport> {
    return this;
  }
  setLoggerFactory(
    loggerFactory: (name: string) => LoggerPublisherService,
  ): TransportBuilder<MockTransport> {
    this._loggerFactory = loggerFactory;
    return this;
  }
  build(): MockTransport {
    if (!this._config) {
      throw new TransportInitializationError("Missing mock transport config");
    }
    if (!this._loggerFactory) {
      throw new TransportInitializationError("Missing logger factory");
    }
    return new MockTransport(this._config.mockUrl, this._loggerFactory);
  }
}
