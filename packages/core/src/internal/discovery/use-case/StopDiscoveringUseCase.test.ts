import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultLoggerService } from "@internal/logger/service/DefaultLoggerService";
import { LoggerService } from "@internal/logger/service/LoggerService";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerService;

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerService([]);
    transport = new WebUsbHidTransport({} as DeviceModelDataSource, logger);
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
