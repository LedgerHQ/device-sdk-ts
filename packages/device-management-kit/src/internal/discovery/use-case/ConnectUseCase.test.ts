import { Left, Maybe, Right } from "purify-ts";

import { type DeviceModel, type DeviceModelId } from "@api/device/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { type DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import {
  TransportNotSupportedError,
  UnknownDeviceError,
} from "@api/transport/model/Errors";
import { type Transport } from "@api/transport/model/Transport";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";
import { type TransportService } from "@internal/transport/service/TransportService";

import { ConnectUseCase } from "./ConnectUseCase";

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("fakeSessionId"),
}));

let transport: Transport;
let transportService: TransportService;
let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApi: ManagerApiService;
let secureChannel: SecureChannelService;
const fakeSessionId = "fakeSessionId";
const fakeSessionIdConnectedDevice = "fakeSessionIdConnectedDevice";

describe("ConnectUseCase", () => {
  const stubDiscoveredDevice: DiscoveredDevice = {
    id: "device-id",
    deviceModel: {} as DeviceModel,
    transport: "USB",
    name: "TEST",
  };
  const stubTransportConnectedDevice = connectedDeviceStubBuilder({ id: "1" });
  const stubConnectedDevice: ConnectedDevice = {
    ...stubTransportConnectedDevice,
    sessionId: fakeSessionIdConnectedDevice,
    modelId: "model-id" as DeviceModelId,
    name: "device-name",
    type: "MOCK" as ConnectionType,
  };
  const tag = "logger-tag";

  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], tag);

    // Mock Transport
    transport = {
      connect: vi.fn(),
    } as unknown as Transport;

    // Mock TransportService
    transportService = {
      getTransport: vi.fn(),
    } as unknown as TransportService;

    // Mock DeviceSessionService
    sessionService = {
      addDeviceSession: vi.fn(),
      removeDeviceSession: vi.fn(),
      getDeviceSessionByDeviceId: vi.fn(),
    } as unknown as DeviceSessionService;

    // Mock ManagerApiService
    managerApi = {} as ManagerApiService;

    // Mock SecureChannelService
    secureChannel = {} as SecureChannelService;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test("should throw an error when transport connection fails", async () => {
    // given
    const connectionError = new UnknownDeviceError();
    vi.mocked(transportService.getTransport).mockReturnValue(
      Maybe.of(transport),
    );
    vi.mocked(transport.connect).mockResolvedValue(Left(connectionError));

    const usecase = new ConnectUseCase(
      transportService,
      sessionService,
      () => logger,
      managerApi,
      secureChannel,
    );

    // when/then
    await expect(
      usecase.execute({ device: stubDiscoveredDevice }),
    ).rejects.toBe(connectionError);

    expect(transportService.getTransport).toHaveBeenCalledWith("USB");
    expect(transport.connect).toHaveBeenCalledWith({
      deviceId: stubDiscoveredDevice.id,
      onDisconnect: expect.any(Function),
    });
  });

  test("should successfully connect and return a deviceSession id", async () => {
    // given
    vi.mocked(transportService.getTransport).mockReturnValue(
      Maybe.of(transport),
    );
    vi.mocked(transport.connect).mockResolvedValue(
      Right(stubTransportConnectedDevice),
    );

    // Spy on addDeviceSession to capture the created session and mock its behavior
    vi.mocked(sessionService.addDeviceSession).mockImplementation(
      (deviceSession) => {
        // Mock the initialiseSession to avoid real initialization
        vi.spyOn(deviceSession, "initialiseSession").mockResolvedValue(
          undefined,
        );
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

    // when
    const sessionId = await usecase.execute({
      device: stubDiscoveredDevice,
    });

    // then
    expect(sessionId).toBe(fakeSessionId);
    expect(transportService.getTransport).toHaveBeenCalledWith("USB");
    expect(transport.connect).toHaveBeenCalledWith({
      deviceId: stubDiscoveredDevice.id,
      onDisconnect: expect.any(Function),
    });
    expect(sessionService.addDeviceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: fakeSessionId,
      }),
    );
  });

  test("should reconnect with existing sessionId when connecting to a ConnectedDevice", async () => {
    // given
    vi.mocked(transportService.getTransport).mockReturnValue(
      Maybe.of(transport),
    );
    vi.mocked(transport.connect).mockResolvedValue(
      Right(stubTransportConnectedDevice),
    );

    // Spy on addDeviceSession to capture the created session and mock its behavior
    vi.mocked(sessionService.addDeviceSession).mockImplementation(
      (deviceSession) => {
        // Mock the initialiseSession to avoid real initialization
        vi.spyOn(deviceSession, "initialiseSession").mockResolvedValue(
          undefined,
        );
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

    // when
    const sessionId = await usecase.execute({
      device: stubConnectedDevice,
    });

    // then
    expect(sessionId).toBe(fakeSessionIdConnectedDevice);
    expect(transportService.getTransport).toHaveBeenCalledWith("USB");
    expect(transport.connect).toHaveBeenCalledWith({
      deviceId: stubConnectedDevice.id,
      onDisconnect: expect.any(Function),
    });
    expect(sessionService.addDeviceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: fakeSessionIdConnectedDevice,
      }),
    );
  });

  test("should throw an error when transport is not supported", async () => {
    // given
    vi.mocked(transportService.getTransport).mockReturnValue(Maybe.empty());

    const usecase = new ConnectUseCase(
      transportService,
      sessionService,
      () => logger,
      managerApi,
      secureChannel,
    );

    // when/then
    await expect(
      usecase.execute({ device: stubDiscoveredDevice }),
    ).rejects.toBeInstanceOf(TransportNotSupportedError);

    expect(transportService.getTransport).toHaveBeenCalledWith("USB");
  });
});
