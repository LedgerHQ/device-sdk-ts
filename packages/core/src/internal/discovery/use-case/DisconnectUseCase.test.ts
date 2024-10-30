import { Left, Maybe, Right } from "purify-ts";

import { DisconnectError } from "@api/transport/model/Errors";
import { TransportStub } from "@api/transport/model/Transport.stub";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { type Transport } from "@api/types";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";

import { DisconnectUseCase } from "./DisconnectUseCase";

let sessionService: DefaultDeviceSessionService;
// TODO test several transports
let transport: Transport;
let transports: Transport[] = [];
const loggerFactory = jest
  .fn()
  .mockReturnValue(
    new DefaultLoggerPublisherService([], "DisconnectUseCaseTest"),
  );
let transportService: TransportService;
let managerApi: ManagerApiService;
let managerApiDataSource: ManagerApiDataSource;

const sessionId = "sessionId";

describe("DisconnectUseCase", () => {
  beforeAll(() => {
    transport = new TransportStub();
    transports = [transport];
    sessionService = new DefaultDeviceSessionService(loggerFactory);
    // @ts-expect-error stub
    transportService = new TransportServiceStub();
    jest
      .spyOn(transportService, "getTransport")
      .mockReturnValue(Maybe.of(transport));
  });

  it("should disconnect from a device", async () => {
    // Given
    const connectedDevice = connectedDeviceStubBuilder();
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    const deviceSession = deviceSessionStubBuilder(
      {
        id: sessionId,
        connectedDevice,
      },
      loggerFactory,
      managerApi,
    );
    jest
      .spyOn(sessionService, "getDeviceSessionById")
      .mockImplementation(() => Right(deviceSession));
    jest.spyOn(deviceSession, "close");
    jest.spyOn(sessionService, "removeDeviceSession");
    jest
      .spyOn(transports[0]!, "disconnect")
      .mockImplementation(() => Promise.resolve(Right(void 0)));
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
    jest
      .spyOn(sessionService, "getDeviceSessionById")
      .mockImplementation(() =>
        Right(
          deviceSessionStubBuilder(
            { id: sessionId },
            loggerFactory,
            managerApi,
          ),
        ),
      );
    jest
      .spyOn(transports[0]!, "disconnect")
      .mockResolvedValue(Promise.resolve(Left(new DisconnectError())));
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
