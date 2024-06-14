import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { GetConnectedDeviceUseCase } from "@internal/usb/use-case/GetConnectedDeviceUseCase";
import { ConnectedDevice } from "@root/src";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;

const fakeSessionId = "fakeSessionId";

describe("GetConnectedDevice", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case",
    );
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  it("should retrieve an instance of ConnectedDevice", () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId },
      () => logger,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetConnectedDeviceUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    // then
    expect(response).toBeInstanceOf(ConnectedDevice);
  });

  it("should retrieve correct device from session", () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId },
      () => logger,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetConnectedDeviceUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    // then
    expect(response).toStrictEqual(
      new ConnectedDevice({
        internalConnectedDevice: deviceSession.connectedDevice,
      }),
    );
  });
});
