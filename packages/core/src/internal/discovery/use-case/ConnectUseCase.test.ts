import { Left, Right } from "purify-ts";
import * as uuid from "uuid";
jest.mock("uuid");

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DefaultManagerApiDataSource } from "@internal/manager-api/data/DefaultManagerApiDataSource";
import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { UnknownDeviceError } from "@internal/usb/model/Errors";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

jest.mock("@internal/manager-api/data/DefaultManagerApiDataSource");

let transport: WebUsbHidTransport;
let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApi: ManagerApiService;
let managerApiDataSource: ManagerApiDataSource;
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
    managerApiDataSource = new DefaultManagerApiDataSource({
      managerApiUrl: "http://fake.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Left(new UnknownDeviceError()));

    const usecase = new ConnectUseCase(
      transport,
      sessionService,
      () => logger,
      managerApi,
    );

    await expect(usecase.execute({ deviceId: "" })).rejects.toBeInstanceOf(
      UnknownDeviceError,
    );
  });

  test("If connect is in success, return a deviceSession id", async () => {
    jest
      .spyOn(transport, "connect")
      .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));

    const usecase = new ConnectUseCase(
      transport,
      sessionService,
      () => logger,
      managerApi,
    );

    const sessionId = await usecase.execute({ deviceId: "" });
    expect(sessionId).toBe(fakeSessionId);
  });
});
