import { Left, Right } from "purify-ts";

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { connectedDeviceBuilder } from "@internal/usb/model/ConnectedDevice.stub";
import { UnknownDeviceError } from "@internal/usb/model/Errors";
import { UsbHidDeviceConnection } from "@internal/usb/model/UsbHidDeviceConnection";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;
let usbHidDeviceConnection: UsbHidDeviceConnection;

describe("ConnectUseCase", () => {
  const stubConnectedDevice = connectedDeviceBuilder("1");
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
      () => usbHidDeviceConnection({}),
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Left(new UnknownDeviceError()));

    const usecase = new ConnectUseCase(transport);

    await expect(usecase.execute({ deviceId: "" })).rejects.toBeInstanceOf(
      UnknownDeviceError,
    );
  });

  test("If connect is in success, return an observable connected device object", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));

    const usecase = new ConnectUseCase(transport);

    const connectedDevice = await usecase.execute({ deviceId: "" });
    expect(connectedDevice).toBe(stubConnectedDevice);
  });
});
