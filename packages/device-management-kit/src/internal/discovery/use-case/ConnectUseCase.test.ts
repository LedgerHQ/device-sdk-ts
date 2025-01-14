import { Left, Maybe, Right } from "purify-ts";

import { type DeviceModel } from "@api/device/DeviceModel";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { type DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { UnknownDeviceError } from "@api/transport/model/Errors";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { type Transport } from "@api/types";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";
import { type TransportService } from "@internal/transport/service/TransportService";

import { ConnectUseCase } from "./ConnectUseCase";

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("fakeSessionId"),
}));

vi.mock("@internal/manager-api/data/AxiosManagerApiDataSource");
vi.mock("@internal/transport/service/DefaultTransportService");

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
    transport = new TransportMock();
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    // @ts-expect-error mock
    transportService = new DefaultTransportService();
  });

  afterEach(() => {
    for (const session of sessionService.getDeviceSessions()) {
      sessionService.removeDeviceSession(session.id);
    }
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", async () => {
    vi.spyOn(transport, "connect").mockResolvedValue(
      Left(new UnknownDeviceError()),
    );

    vi.spyOn(transportService, "getTransport").mockReturnValue(
      Maybe.of(transport),
    );

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
    vi.spyOn(transport, "connect").mockResolvedValue(
      Right(stubConnectedDevice),
    );

    vi.spyOn(transportService, "getTransport").mockReturnValue(
      Maybe.of(transport),
    );

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
