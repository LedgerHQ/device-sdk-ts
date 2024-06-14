import { Left, Right } from "purify-ts";
import * as uuid from "uuid";
jest.mock("uuid");

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { UnknownDeviceError } from "@internal/usb/model/Errors";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
const fakeSessionId = "fakeSessionId";

describe("ConnectUseCase", () => {
  const stubConnectedDevice = connectedDeviceStubBuilder({ id: "1" });
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    jest.spyOn(uuid, "v4").mockReturnValue(fakeSessionId);
    transport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
      usbHidDeviceConnectionFactoryStubBuilder(),
    );
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Left(new UnknownDeviceError()));

    const usecase = new ConnectUseCase(transport, sessionService, () => logger);

    await expect(usecase.execute({ deviceId: "" })).rejects.toBeInstanceOf(
      UnknownDeviceError,
    );
  });

  test("If connect is in success, return a deviceSession id", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));

    const usecase = new ConnectUseCase(transport, sessionService, () => logger);

    const sessionId = await usecase.execute({ deviceId: "" });
    expect(sessionId).toBe(fakeSessionId);
  });
});
