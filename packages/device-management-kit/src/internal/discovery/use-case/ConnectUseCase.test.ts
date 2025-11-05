import { Left, Maybe, Right } from "purify-ts";

import { type DeviceModel, type DeviceModelId } from "@api/device/DeviceModel";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { type ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { type DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { UnknownDeviceError } from "@api/transport/model/Errors";
import { type Transport } from "@api/transport/model/Transport";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";
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
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;
const fakeSessionId = "fakeSessionId";
const fakeSessionIdConnectedDevice = "fakeSessionIdConnectedDevice";

describe("ConnectUseCase", () => {
  const stubDiscoveredDevice: DiscoveredDevice = {
    id: "",
    deviceModel: {} as DeviceModel,
    transport: "USB",
    name: "TEST",
  };
  const stubTransportConnectedDevice = connectedDeviceStubBuilder({ id: "1" });
  const stubConnectedDevice = {
    id: "1",
    sessionId: fakeSessionIdConnectedDevice,
    modelId: "model-id" as unknown as DeviceModelId,
    name: "device-name",
    type: "MOCK" as unknown as ConnectionType,
    transport: "USB",
  } as unknown as ConnectedDevice;
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    transport = new TransportMock();
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
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
      secureChannel,
    );

    await expect(
      usecase.execute({ device: stubDiscoveredDevice }),
    ).rejects.toBeInstanceOf(UnknownDeviceError);
  });

  test("If connect is in success, return a deviceSession id", async () => {
    vi.spyOn(transport, "connect").mockResolvedValue(
      Right(stubTransportConnectedDevice),
    );
    vi.spyOn(transportService, "getTransport").mockReturnValue(
      Maybe.of(transport),
    );
    vi.spyOn(sessionService, "addDeviceSession").mockImplementation(
      (deviceSession) => {
        deviceSession.setDeviceSessionState({} as DeviceSessionState);
        return sessionService;
      },
    );

    const usecase = new ConnectUseCase(
      transportService,
      sessionService,
      () => logger,
      managerApi,
      secureChannel,
    );

    const sessionId = await usecase.execute({
      device: stubDiscoveredDevice,
    });
    expect(sessionId).toBe(fakeSessionId);
    sessionService.removeDeviceSession(sessionId);
  });

  test("If connect is in success after a reconnect, return the same deviceSession id", async () => {
    vi.spyOn(transport, "connect").mockResolvedValue(
      Right(stubTransportConnectedDevice),
    );
    vi.spyOn(transportService, "getTransport").mockReturnValue(
      Maybe.of(transport),
    );
    vi.spyOn(sessionService, "addDeviceSession").mockImplementation(
      (deviceSession) => {
        deviceSession.setDeviceSessionState({} as DeviceSessionState);
        return sessionService;
      },
    );

    const usecase = new ConnectUseCase(
      transportService,
      sessionService,
      () => logger,
      managerApi,
      secureChannel,
    );

    const sessionId = await usecase.execute({
      device: stubConnectedDevice,
    });
    expect(sessionId).toBe(fakeSessionIdConnectedDevice); // same session id as the connected device
    sessionService.removeDeviceSession(sessionId);
  });
});
