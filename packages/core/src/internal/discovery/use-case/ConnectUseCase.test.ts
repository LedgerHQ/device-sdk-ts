import { Left, Right } from "purify-ts";
import * as uuid from "uuid";
jest.mock("uuid");

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { SessionService } from "@internal/device-session/service/SessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { connectedDeviceStubBuilder } from "@internal/usb/model/ConnectedDevice.stub";
import { UnknownDeviceError } from "@internal/usb/model/Errors";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;
let sessionService: SessionService;
const fakeSessionId = "42";

describe("ConnectUseCase", () => {
  const stubConnectedDevice = connectedDeviceStubBuilder("1");
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    jest.spyOn(uuid, "v4").mockReturnValue(fakeSessionId);
    transport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      () => logger,
      usbHidDeviceConnectionFactoryStubBuilder(),
    );
    sessionService = new DefaultSessionService(() => logger);
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

  test("If connect is in success, return a session id", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));

    const usecase = new ConnectUseCase(transport, sessionService, () => logger);

    const connectedDevice = await usecase.execute({ deviceId: "" });
    expect(connectedDevice).toBe(fakeSessionId);
  });
});
