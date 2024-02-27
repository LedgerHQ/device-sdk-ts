import { of } from "rxjs";

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DeviceModel } from "@internal/device-model/model/DeviceModel";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";
import { DiscoveredDevice } from "@root/src";

import { StartDiscoveringUseCase } from "./StartDiscoveringUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;

describe("StartDiscoveringUseCase", () => {
  const stubDiscoveredDevice: DiscoveredDevice = {
    id: "",
    deviceModel: {} as DeviceModel,
  };
  const tag = "logger-tag";

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

  test("If connect use case encounter an error, return it", (done) => {
    const mockedStartDiscovering = jest.fn(() => {
      return of(stubDiscoveredDevice);
    });
    jest
      .spyOn(transport, "startDiscovering")
      .mockImplementation(mockedStartDiscovering);
    const usecase = new StartDiscoveringUseCase(transport);

    const discover = usecase.execute();

    expect(mockedStartDiscovering).toHaveBeenCalled();
    discover.subscribe({
      next: (discoveredDevice) => {
        expect(discoveredDevice).toBe(stubDiscoveredDevice);
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });
});
