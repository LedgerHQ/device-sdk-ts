import { Maybe } from "purify-ts";
import { of } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { type DeviceModelId, type DiscoveredDevice } from "@api/types";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";
import { webHidDeviceConnectionFactoryStubBuilder } from "@internal/transport/usb/service/WebHidDeviceConnectionFactory.stub";
import { WebHidTransport } from "@internal/transport/usb/transport/WebHidTransport";

import { StartDiscoveringUseCase } from "./StartDiscoveringUseCase";

let transport: WebHidTransport;
let transportService: TransportService;
let logger: LoggerPublisherService;

describe("StartDiscoveringUseCase", () => {
  const stubDiscoveredDevice: TransportDiscoveredDevice = {
    id: "internal-discovered-device-id",
    deviceModel: {
      id: "nanoSP" as DeviceModelId,
      productName: "productName",
    } as TransportDeviceModel,
    transport: "USB",
  };
  const tag = "logger-tag";

  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transport = new WebHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
      webHidDeviceConnectionFactoryStubBuilder(),
    );
    // @ts-expect-error stub
    transportService = new TransportServiceStub();
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

    jest
      .spyOn(transportService, "getTransport")
      .mockReturnValue(Maybe.of(transport));
    const usecase = new StartDiscoveringUseCase(transportService);

    const discover = usecase.execute({ transport: "USB" });

    expect(mockedStartDiscovering).toHaveBeenCalled();
    discover.subscribe({
      next: (discoveredDevice) => {
        expect(discoveredDevice).toStrictEqual({
          id: "internal-discovered-device-id",
          transport: "USB",
          deviceModel: new DeviceModel({
            id: "internal-discovered-device-id",
            model: "nanoSP" as DeviceModelId,
            name: "productName",
          }),
        } as DiscoveredDevice);
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });
});
