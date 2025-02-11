import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { type DmkConfig } from "@api/DmkConfig";
import { type Transport } from "@api/types";
import { DefaultLoggerPublisherServiceStub } from "@internal/logger-publisher/service/DefaultLoggerPublisherService.stub";
import { type TransportService } from "@internal/transport/service/TransportService";

const loggerFactory = (_arg: string) => new DefaultLoggerPublisherServiceStub();

export class DefaultTransportService implements TransportService {
  _transports: Map<string, Transport> = new Map();
  _loggerModuleFactory = loggerFactory;
  _config = {} as DmkConfig;
  _deviceModelDataSource = {} as DeviceModelDataSource;
  _apduSenderServiceFactory = vi.fn();
  _apduReceiverServiceFactory = vi.fn();
  _logger = loggerFactory("TransportServiceMock");

  addTransport = vi.fn();
  addTransportInternal = vi.fn();
  getTransport = vi.fn();
  getAllTransports = vi.fn();
  closeAllTransports = vi.fn();
}
