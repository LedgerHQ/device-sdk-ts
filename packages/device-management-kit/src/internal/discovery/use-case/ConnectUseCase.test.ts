import { Left, Right } from "purify-ts";
import * as uuid from "uuid";
jest.mock("uuid");

import { type DeviceModel } from "@api/device/DeviceModel";
import { type DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { type DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { UnknownDeviceError } from "@internal/transport/model/Errors";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/transport/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

// TODO test several transports
let transports: WebUsbHidTransport[];
let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApi: ManagerApiService;
let managerApiDataSource: ManagerApiDataSource;
const fakeSessionId = "fakeSessionId";

describe("ConnectUseCase", () => {
  const stubDiscoveredDevice: DiscoveredDevice = {
    id: "",
    deviceModel: {} as DeviceModel,
    transport: "USB",
  };
  const stubConnectedDevice = connectedDeviceStubBuilder({ id: "1" });
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    jest.spyOn(uuid, "v4").mockReturnValue(fakeSessionId);
    transports = [
      new WebUsbHidTransport(
        {} as DeviceModelDataSource,
        () => logger,
        usbHidDeviceConnectionFactoryStubBuilder(),
      ),
    ];
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
  });

  afterEach(() => {
    for (const session of sessionService.getDeviceSessions()) {
      sessionService.removeDeviceSession(session.id);
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", async () => {
    jest
      .spyOn(transports[0]!, "connect")
      .mockResolvedValue(Left(new UnknownDeviceError()));

    const usecase = new ConnectUseCase(
      transports,
      sessionService,
      () => logger,
      managerApi,
    );

    await expect(
      usecase.execute({ device: stubDiscoveredDevice }),
    ).rejects.toBeInstanceOf(UnknownDeviceError);
  });

  test("If connect is in success, return a deviceSession id", async () => {
    jest
      .spyOn(transports[0]!, "connect")
      .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));

    const usecase = new ConnectUseCase(
      transports,
      sessionService,
      () => logger,
      managerApi,
    );

    const sessionId = await usecase.execute({
      device: stubDiscoveredDevice,
    });
    expect(sessionId).toBe(fakeSessionId);
    sessionService.removeDeviceSession(sessionId);
  });
});
