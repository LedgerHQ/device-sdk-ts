import { Left, Maybe, Right } from "purify-ts";

import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { DisconnectError } from "@api/transport/model/Errors";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import type { DmkConfig, Transport } from "@api/types";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
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

import { DisconnectUseCase } from "./DisconnectUseCase";

vi.mock("@internal/transport/service/DefaultTransportService");

let sessionService: DefaultDeviceSessionService;
// TODO test several transports
let transport: Transport;
let transports: Transport[] = [];
const loggerFactory = vi
  .fn()
  .mockReturnValue(
    new DefaultLoggerPublisherService([], "DisconnectUseCaseTest"),
  );
let transportService: TransportService;
let managerApi: ManagerApiService;
let managerApiDataSource: ManagerApiDataSource;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;

const sessionId = "sessionId";

describe("DisconnectUseCase", () => {
  beforeAll(() => {
    transport = new TransportMock();
    transports = [transport];
    sessionService = new DefaultDeviceSessionService(loggerFactory);
    // @ts-expect-error mock
    transportService = new DefaultTransportService();
    vi.spyOn(transportService, "getTransport").mockReturnValue(
      Maybe.of(transport),
    );
  });

  it("should disconnect from a device", async () => {
    // Given
    const connectedDevice = connectedDeviceStubBuilder();
    managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
    const deviceSession = deviceSessionStubBuilder(
      {
        id: sessionId,
        connectedDevice,
      },
      loggerFactory,
      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    vi.spyOn(sessionService, "getDeviceSessionById").mockImplementation(() =>
      Right(deviceSession),
    );
    vi.spyOn(deviceSession, "close");
    vi.spyOn(sessionService, "removeDeviceSession");
    vi.spyOn(transports[0]!, "disconnect").mockImplementation(() =>
      Promise.resolve(Right(undefined)),
    );
    const disconnectUseCase = new DisconnectUseCase(
      transportService,
      sessionService,
      loggerFactory,
    );
    // When
    await disconnectUseCase.execute({ sessionId });

    // Then
    expect(deviceSession.close).toHaveBeenCalled();
    expect(sessionService.removeDeviceSession).toHaveBeenCalledWith(sessionId);
    expect(transports[0]!.disconnect).toHaveBeenCalledWith({
      connectedDevice,
    });
  });

  it("should throw an error when deviceSession not found", async () => {
    // Given
    const disconnectUseCase = new DisconnectUseCase(
      transportService,
      sessionService,
      loggerFactory,
    );

    // When
    try {
      await disconnectUseCase.execute({ sessionId });
    } catch (e) {
      // Then
      expect(e).toStrictEqual(new DeviceSessionNotFound());
    }
  });

  it("should throw an error if usb hid disconnection fails", async () => {
    // Given
    vi.spyOn(sessionService, "getDeviceSessionById").mockImplementation(() =>
      Right(
        deviceSessionStubBuilder(
          { id: sessionId },
          loggerFactory,
          managerApi,
          secureChannel,
          DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
        ),
      ),
    );

    vi.spyOn(transports[0]!, "disconnect").mockResolvedValue(
      Left(new DisconnectError()),
    );

    const disconnectUseCase = new DisconnectUseCase(
      transportService,
      sessionService,
      loggerFactory,
    );

    // When
    try {
      await disconnectUseCase.execute({ sessionId });
    } catch (e) {
      // Then
      expect(e).toStrictEqual(new DisconnectError());
    }
  });
});
