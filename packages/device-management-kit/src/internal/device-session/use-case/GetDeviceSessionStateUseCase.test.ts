import { type DmkConfig } from "@api/DmkConfig";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { HttpManagerApiDataSource } from "@internal/manager-api/data/HttpManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import { GetDeviceSessionStateUseCase } from "./GetDeviceSessionStateUseCase";

vi.mock("@internal/manager-api/data/HttpManagerApiDataSource");

let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;

const fakeSessionId = "fakeSessionId";

describe("GetDeviceSessionStateUseCase", () => {
  beforeEach(() => {
    managerApiDataSource = new HttpManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
    sessionService = new DefaultDeviceSessionService();
  });

  // TODO: This test does not close a subscription
  // ¯\_(ツ)_/¯ I cannot find which one unfortunatly
  it("should retrieve deviceSession device state", () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId },

      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetDeviceSessionStateUseCase(sessionService);

    const res = useCase.execute({ sessionId: fakeSessionId });
    const expected = deviceSession.state;

    deviceSession.close();

    // then
    expect(res).toStrictEqual(expected);
  });

  it("should throw error when deviceSession is not found", () =>
    new Promise<void>((resolve) => {
      // given
      const useCase = new GetDeviceSessionStateUseCase(sessionService);

      // when
      try {
        useCase
          .execute({
            sessionId: fakeSessionId,
          })
          .subscribe();
      } catch (error) {
        // then
        expect(error).toBeInstanceOf(DeviceSessionNotFound);
        resolve();
      }
    }));
});
