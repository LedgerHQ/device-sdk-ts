import { of } from "rxjs";

import { DiscoveredDevice } from "@api/types";
import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { StartDiscoveringUseCase } from "./StartDiscoveringUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;

describe("StartDiscoveringUseCase", () => {
  const stubDiscoveredDevice: DiscoveredDevice = {
    id: "",
    deviceModel: {} as InternalDeviceModel,
  };
  const tag = "logger-tag";

  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
      usbHidDeviceConnectionFactoryStubBuilder(),
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
