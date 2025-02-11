import { type DmkConfig } from "@api/DmkConfig";
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
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";
import { DefaultTransportService } from "@internal/transport/service/__mocks__/DefaultTransportService";

let logger: LoggerPublisherService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;
let sessionService: DeviceSessionService;
let transportService: DefaultTransportService;

describe("CloseSessionsUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "close-sessions-use-case-test",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
    sessionService = new DefaultDeviceSessionService(() => logger);
    transportService = new DefaultTransportService();
  });

  it("should be able to close every session", () => {
    //given
    const sessions = [...Array(10).keys()].map((id) => {
      const session = deviceSessionStubBuilder(
        { id: id.toString() },
        () => logger,
        managerApi,
        secureChannel,
      );
      vi.spyOn(session, "close");
      return session;
    });
    sessions.forEach((session) => sessionService.addDeviceSession(session));
    const useCase = new CloseSessionsUseCase(sessionService, transportService);
    //when
    useCase.execute();
    //then
    sessions.forEach((session) => {
      expect(session.close).toHaveBeenCalled();
    });
  });
});
