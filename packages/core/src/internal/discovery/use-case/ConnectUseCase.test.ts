import { Left, Right } from "purify-ts";

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DeviceModel } from "@internal/device-model/model/DeviceModel";
import { DefaultLoggerService } from "@internal/logger/service/DefaultLoggerService";
import { LoggerService } from "@internal/logger/service/LoggerService";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";
import { UnknownDeviceError } from "@internal/usb/model/Errors";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerService;

describe("ConnectUseCase", () => {
  const stubConnectedDevice: ConnectedDevice = {
    id: "",
    deviceModel: {} as DeviceModel,
  };
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerService([], tag);
    transport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
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
