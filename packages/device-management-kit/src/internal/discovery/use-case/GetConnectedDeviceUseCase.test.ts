import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { GetConnectedDeviceUseCase } from "./GetConnectedDeviceUseCase";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;

const fakeSessionId = "fakeSessionId";

describe("GetConnectedDevice", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  it("should retrieve an instance of ConnectedDevice", () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId },
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetConnectedDeviceUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    deviceSession.close();

    // then
    expect(response).toBeInstanceOf(ConnectedDevice);
  });

  it("should retrieve correct device from session", () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId },
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetConnectedDeviceUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    deviceSession.close();

    // then
    expect(response).toStrictEqual(
      new ConnectedDevice({
        sessionId: fakeSessionId,
        transportConnectedDevice: deviceSession.connectedDevice,
      }),
    );
  });
});
