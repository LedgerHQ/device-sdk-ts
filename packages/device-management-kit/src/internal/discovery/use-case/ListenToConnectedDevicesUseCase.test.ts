import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { ListenToConnectedDevicesUseCase } from "@internal/discovery/use-case/ListenToConnectedDevicesUseCase";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { HttpManagerApiDataSource } from "@internal/manager-api/data/HttpManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

vi.mock("@internal/manager-api/data/HttpManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApi: ManagerApiService;
let secureChannel: SecureChannelService;

const buildDeviceSession = (id: string): DeviceSession =>
  deviceSessionStubBuilder(
    {
      id,
      connectedDevice: connectedDeviceStubBuilder({ id: `device-${id}` }),
    },
    () => logger,
    managerApi,
    secureChannel,
    DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
  );

const toConnectedDevice = (deviceSession: DeviceSession) =>
  new ConnectedDevice({
    transportConnectedDevice: deviceSession.connectedDevice,
    sessionId: deviceSession.id,
  });

describe("ListenToConnectedDevicesUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "listen-to-connected-devices-use-case",
    );
    managerApi = new DefaultManagerApiService(
      new HttpManagerApiDataSource({} as DmkConfig, () => logger),
    );
    secureChannel = new DefaultSecureChannelService(
      new DefaultSecureChannelDataSource({} as DmkConfig),
    );
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  it("should emit the connected devices when sessions are added or removed", () => {
    // given
    const sessionA = buildDeviceSession("session-a");
    const sessionB = buildDeviceSession("session-b");
    sessionService.addDeviceSession(sessionA);
    const emittedLists: ConnectedDevice[][] = [];
    const subscription = new ListenToConnectedDevicesUseCase(
      sessionService,
      () => logger,
    )
      .execute()
      .subscribe((connectedDevices) => emittedLists.push(connectedDevices));

    // when
    sessionService.addDeviceSession(sessionB);
    sessionService.removeDeviceSession(sessionA.id);

    // then
    expect(emittedLists).toEqual([
      [toConnectedDevice(sessionA)],
      [toConnectedDevice(sessionA), toConnectedDevice(sessionB)],
      [toConnectedDevice(sessionB)],
    ]);
    subscription.unsubscribe();
    sessionB.close();
  });

  it("should not emit a session removed before the subscription", () => {
    // given
    const closedSession = buildDeviceSession("closed-session");
    sessionService.addDeviceSession(closedSession);
    sessionService.removeDeviceSession(closedSession.id);
    const emittedLists: ConnectedDevice[][] = [];

    // when
    const subscription = new ListenToConnectedDevicesUseCase(
      sessionService,
      () => logger,
    )
      .execute()
      .subscribe((connectedDevices) => emittedLists.push(connectedDevices));

    // then
    expect(emittedLists).toEqual([[]]);
    subscription.unsubscribe();
  });
});
