import { DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { SdkConfig } from "@api/SdkConfig";
import { Transport } from "@api/types";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/__mocks__/DefaultLoggerService";

const loggerFactory = (_arg: string) => new DefaultLoggerPublisherService();
export class TransportServiceStub {
  _transports: Map<string, Transport> = new Map();
  _loggerModuleFactory = loggerFactory;
  _config = {} as SdkConfig;
  _deviceModelDataSource = {} as DeviceModelDataSource;
  _apduSenderServiceFactory = jest.fn();
  _apduReceiverServiceFactory = jest.fn();
  _logger = loggerFactory("TransportServiceStub");

  addTransport = jest.fn();
  addTransportInternal = jest.fn();
  getTransport = jest.fn();
  getAllTransports = jest.fn();
}
