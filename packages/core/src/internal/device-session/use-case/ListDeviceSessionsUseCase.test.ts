import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { ListDeviceSessionsUseCase } from "./ListDeviceSessionsUseCase";

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
    const useCase = new ListDeviceSessionsUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute();

    // then
    expect(response).toStrictEqual([deviceSession1, deviceSession2]);
  });

  it("should return empty array if no device sessions", () => {
    // given
    const useCase = new ListDeviceSessionsUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute();

    // then
    expect(response).toStrictEqual([]);
  });
});
