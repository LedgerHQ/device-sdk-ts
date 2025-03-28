import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import { DisableDeviceSessionRefresherUseCase } from "./DisableDeviceSessionRefresher";

vi.mock("uuid", () => ({
  v4: () => "fakeUuid",
}));

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let useCase: DisableDeviceSessionRefresherUseCase;
let deviceSession: DeviceSession;
let managerApi: ManagerApiService;
let secureChannel: SecureChannelService;
describe("DisableDeviceSessionRefresherUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case-test",
    );
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApi = new DefaultManagerApiService(
      new AxiosManagerApiDataSource({} as DmkConfig),
    );
    secureChannel = new DefaultSecureChannelService(
      new DefaultSecureChannelDataSource({} as DmkConfig),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should disable the device session refresher and return a function to reenable it", () => {
      // given
      deviceSession = deviceSessionStubBuilder(
        { id: "fakeSessionId" },
        () => logger,
        managerApi,
        secureChannel,
        DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
      );
      sessionService.addDeviceSession(deviceSession);
      useCase = new DisableDeviceSessionRefresherUseCase(
        sessionService,
        () => logger,
      );

      const spy = vi.spyOn(deviceSession, "disableRefresher");

      // when
      const reenableRefresher = useCase.execute({
        sessionId: "fakeSessionId",
        blockerId: "fakeBlockerId",
      });

      // then
      expect(spy).toHaveBeenCalledWith("fakeBlockerId");
      reenableRefresher();
      deviceSession.close();
    });

    it("should throw error when deviceSession is not found", () => {
      // given
      useCase = new DisableDeviceSessionRefresherUseCase(
        sessionService,
        () => logger,
      );

      // when
      try {
        useCase.execute({
          sessionId: "fakeSessionId",
          blockerId: "fakeBlockerId",
        });
      } catch (error) {
        // then
        expect(error).toBeInstanceOf(DeviceSessionNotFound);
      }
    });
  });
});
