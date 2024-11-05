import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { type DmkConfig } from "@api/DmkConfig";
import { type Transport } from "@api/types";
import { DefaultLoggerPublisherServiceStub } from "@internal/logger-publisher/service/DefaultLoggerPublisherService.stub";

const loggerFactory = (_arg: string) => new DefaultLoggerPublisherServiceStub();
export class TransportServiceStub {
  _transports: Map<string, Transport> = new Map();
  _loggerModuleFactory = loggerFactory;
  _config = {} as DmkConfig;
  _deviceModelDataSource = {} as DeviceModelDataSource;
  _apduSenderServiceFactory = jest.fn();
  _apduReceiverServiceFactory = jest.fn();
  _logger = loggerFactory("TransportServiceStub");

  addTransport = jest.fn();
  addTransportInternal = jest.fn();
  getTransport = jest.fn();
  getAllTransports = jest.fn();
}
