import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;
const tag = "logger-tag";

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call stop discovering", () => {
    const mockedStopDiscovering = jest.fn();
    jest
      .spyOn(transport, "stopDiscovering")
      .mockImplementation(mockedStopDiscovering);
    const usecase = new StopDiscoveringUseCase(transport);

    usecase.execute();

    expect(mockedStopDiscovering).toHaveBeenCalled();
  });
});
