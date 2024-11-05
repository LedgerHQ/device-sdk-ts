import { Left, Maybe, Right } from "purify-ts";
import * as uuid from "uuid";
jest.mock("uuid");

import { type DeviceModel } from "@api/device/DeviceModel";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { UnknownDeviceError } from "@api/transport/model/Errors";
import { TransportStub } from "@api/transport/model/Transport.stub";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { type Transport } from "@api/types";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";

import { ConnectUseCase } from "./ConnectUseCase";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

// TODO test several transports
// let transports: WebUsbHidTransport[];
let transport: Transport;
let transportService: TransportService;
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
    transport = new TransportStub();
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    // @ts-expect-error stub
    transportService = new TransportServiceStub();
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
      .spyOn(transport, "connect")
      .mockResolvedValue(Left(new UnknownDeviceError()));

    jest
      .spyOn(transportService, "getTransport")
      .mockReturnValue(Maybe.of(transport));

    const usecase = new ConnectUseCase(
      transportService,
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
      .spyOn(transport, "connect")
      .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));

    jest
      .spyOn(transportService, "getTransport")
      .mockReturnValue(Maybe.of(transport));

    const usecase = new ConnectUseCase(
      transportService,
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
