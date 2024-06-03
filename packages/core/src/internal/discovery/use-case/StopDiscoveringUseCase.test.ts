import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/transport/usb/transport/WebUsbHidTransport";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

// TODO test several transports
let transports: WebUsbHidTransport[];
let logger: LoggerPublisherService;
const tag = "logger-tag";

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transports = [
      new WebUsbHidTransport(
        {} as DeviceModelDataSource,
        () => logger,
        usbHidDeviceConnectionFactoryStubBuilder(),
      ),
    ];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call stop discovering", () => {
    const mockedStopDiscovering = jest.fn();
    jest
      .spyOn(transports[0]!, "stopDiscovering")
      .mockImplementation(mockedStopDiscovering);
    const usecase = new StopDiscoveringUseCase(transports);

    usecase.execute();

    expect(mockedStopDiscovering).toHaveBeenCalled();
  });
});
