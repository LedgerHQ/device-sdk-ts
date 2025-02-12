import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
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

import { ToggleDeviceSessionRefresherUseCase } from "./ToggleDeviceSessionRefresher";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let useCase: ToggleDeviceSessionRefresherUseCase;
let deviceSession: DeviceSession;
let managerApi: ManagerApiService;
let secureChannel: SecureChannelService;
describe("ToggleDeviceSessionRefresherUseCase", () => {
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
    it("should toggle the device session refresher", () => {
      // given
      deviceSession = deviceSessionStubBuilder(
        { id: "fakeSessionId" },
        () => logger,
        managerApi,
        secureChannel,
      );
      sessionService.addDeviceSession(deviceSession);
      useCase = new ToggleDeviceSessionRefresherUseCase(
        sessionService,
        () => logger,
      );

      const spy = vi.spyOn(deviceSession, "toggleRefresher");

      // when
      useCase.execute({ sessionId: "fakeSessionId", enabled: false });

      // then
      expect(spy).toHaveBeenCalledWith(false);
      deviceSession.close();
    });

    it("should throw error when deviceSession is not found", () => {
      // given
      useCase = new ToggleDeviceSessionRefresherUseCase(
        sessionService,
        () => logger,
      );

      // when
      try {
        useCase.execute({ sessionId: "fakeSessionId", enabled: false });
      } catch (error) {
        // then
        expect(error).toBeInstanceOf(DeviceSessionNotFound);
      }
    });
  });
});
