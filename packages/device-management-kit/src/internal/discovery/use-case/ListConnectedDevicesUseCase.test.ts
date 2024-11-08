import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { ListConnectedDevicesUseCase } from "@internal/discovery/use-case/ListConnectedDevicesUseCase";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { ConnectedDevice } from "@root/src";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;

describe("ListDeviceSessionsUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "list-device-sessions-use-case-test",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  it("should list all device sessions", () => {
    // given
    const deviceSession1 = deviceSessionStubBuilder(
      { id: "1" },
      () => logger,
      managerApi,
    );
    const deviceSession2 = deviceSessionStubBuilder(
      { id: "2" },
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession1);
    sessionService.addDeviceSession(deviceSession2);
    const useCase = new ListConnectedDevicesUseCase(
      sessionService,
      () => logger,
    );

    // when
    const response = useCase.execute();

    deviceSession1.close();
    deviceSession2.close();

    // then
    expect(response).toStrictEqual([
      new ConnectedDevice({
        transportConnectedDevice: deviceSession1.connectedDevice,
        sessionId: deviceSession1.id,
      }),
      new ConnectedDevice({
        transportConnectedDevice: deviceSession2.connectedDevice,
        sessionId: deviceSession2.id,
      }),
    ]);
  });

  it("should return empty array if no device sessions", () => {
    // given
    const useCase = new ListConnectedDevicesUseCase(
      sessionService,
      () => logger,
    );

    // when
    const response = useCase.execute();

    // then
    expect(response).toStrictEqual([]);
  });
});
