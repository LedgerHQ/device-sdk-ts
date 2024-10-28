import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { type Transport } from "@api/types";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";
import { webHidDeviceConnectionFactoryStubBuilder } from "@internal/transport/usb/service/WebHidDeviceConnectionFactory.stub";
import { WebHidTransport } from "@internal/transport/usb/transport/WebHidTransport";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

// TODO test several transports
let transport: Transport;
let transports: Transport[];
let logger: LoggerPublisherService;
let transportService: TransportService;
const tag = "logger-tag";

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transport = new WebHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
      webHidDeviceConnectionFactoryStubBuilder(),
    );
    transports = [transport];
    // @ts-expect-error stub
    transportService = new TransportServiceStub(transports);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call stop discovering", () => {
    const mockedStopDiscovering = jest.fn();
    jest
      .spyOn(transport, "stopDiscovering")
      .mockImplementation(mockedStopDiscovering);

    jest
      .spyOn(transportService, "getAllTransports")
      .mockReturnValue(transports);

    const usecase = new StopDiscoveringUseCase(transportService);

    usecase.execute();

    expect(mockedStopDiscovering).toHaveBeenCalled();
  });
});
