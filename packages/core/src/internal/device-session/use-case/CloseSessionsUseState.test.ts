import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { CloseSessionsUseCase } from "@internal/device-session/use-case/CloseSessionsUseCase";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

let logger: LoggerPublisherService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let sessionService: DeviceSessionService;

describe("CloseSessionsUseState", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "close-sessions-use-case-test",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  it("should be able to close every session", () => {
    //given
    const sessions = [...Array(10).keys()].map((id) => {
      const session = deviceSessionStubBuilder(
        { id: id.toString() },
        () => logger,
        managerApi,
      );
      jest.spyOn(session, "close");
      return session;
    });
    sessions.forEach((session) => sessionService.addDeviceSession(session));
    const useCase = new CloseSessionsUseCase(sessionService);
    //when
    useCase.execute();
    //then
    sessions.forEach((session) => {
      expect(session.close).toHaveBeenCalled();
    });
  });
});
