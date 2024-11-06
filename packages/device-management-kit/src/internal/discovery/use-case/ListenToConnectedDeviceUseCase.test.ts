import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { ListenToConnectedDeviceUseCase } from "@internal/discovery/use-case/ListenToConnectedDeviceUseCase";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;

const fakeSessionId = "test-list-connected-device-session-id";

describe("ListenToConnectedDevice", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "listen-to-connected-device-use-case",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
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
    );
    const observable = new ListenToConnectedDeviceUseCase(
      sessionService,
      () => logger,
    ).execute();

    observable.subscribe({
      next(emittedConnectedDevice) {
        // then
        expect(emittedConnectedDevice).toEqual(
          new ConnectedDevice({
            internalConnectedDevice: connectedDevice,
            sessionId: fakeSessionId,
          }),
        );
        done();
      },
    });

    // when
    sessionService.addDeviceSession(deviceSession);
  });
});
