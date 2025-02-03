import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { ListenToConnectedDeviceUseCase } from "@internal/discovery/use-case/ListenToConnectedDeviceUseCase";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;

const fakeSessionId = "test-list-connected-device-session-id";

describe("ListenToConnectedDevice", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "listen-to-connected-device-use-case",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  it("should emit an instance of ConnectedDevice", (done) => {
    // given
    const connectedDevice = connectedDeviceStubBuilder({
      id: "test-list-connected-device-id",
    });
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId, connectedDevice },
      () => logger,
      managerApi,
      secureChannel,
    );
    const observable = new ListenToConnectedDeviceUseCase(
      sessionService,
      () => logger,
    ).execute();

    const subscription = observable.subscribe({
      next(emittedConnectedDevice) {
        // then
        expect(emittedConnectedDevice).toEqual(
          new ConnectedDevice({
            transportConnectedDevice: connectedDevice,
            sessionId: fakeSessionId,
          }),
        );
        terminate();
      },
    });

    function terminate() {
      subscription.unsubscribe();
      deviceSession.close();
      done();
    }

    // when
    sessionService.addDeviceSession(deviceSession);
  });
});
