import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { ListConnectedDevicesUseCase } from "@internal/discovery/use-case/ListConnectedDevicesUseCase";
import { HttpManagerApiDataSource } from "@internal/manager-api/data/HttpManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";
import { type DmkConfig } from "@root/src";

let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;

describe("ListDeviceSessionsUseCase", () => {
  beforeEach(() => {
    managerApiDataSource = new HttpManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
    sessionService = new DefaultDeviceSessionService();
  });

  it("should list all device sessions", () => {
    // given
    const deviceSession1 = deviceSessionStubBuilder(
      { id: "1" },

      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    const deviceSession2 = deviceSessionStubBuilder(
      { id: "2" },

      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    sessionService.addDeviceSession(deviceSession1);
    sessionService.addDeviceSession(deviceSession2);
    const useCase = new ListConnectedDevicesUseCase(sessionService);

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
    const useCase = new ListConnectedDevicesUseCase(sessionService);

    // when
    const response = useCase.execute();

    // then
    expect(response).toStrictEqual([]);
  });
});
