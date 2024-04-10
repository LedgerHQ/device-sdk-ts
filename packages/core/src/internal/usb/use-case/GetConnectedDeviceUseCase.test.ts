import { sessionStubBuilder } from "@internal/device-session/model/Session.stub";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { SessionService } from "@internal/device-session/service/SessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { GetConnectedDeviceUseCase } from "@internal/usb/use-case/GetConnectedDeviceUseCase";
import { ConnectedDevice } from "@root/src";

let logger: LoggerPublisherService;
let sessionService: SessionService;

const fakeSessionId = "fakeSessionId";

describe("GetConnectedDevice", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case",
    );
    sessionService = new DefaultSessionService(() => logger);
  });

  it("should retrieve an instance of ConnectedDevice", () => {
    // given
    const session = sessionStubBuilder({ id: fakeSessionId });
    sessionService.addSession(session);
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
    const session = sessionStubBuilder({ id: fakeSessionId });
    sessionService.addSession(session);
    const useCase = new GetConnectedDeviceUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    // then
    expect(response).toStrictEqual(
      new ConnectedDevice({ internalConnectedDevice: session.connectedDevice }),
    );
  });
});
