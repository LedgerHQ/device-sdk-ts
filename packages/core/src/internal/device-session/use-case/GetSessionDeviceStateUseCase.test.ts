import { sessionStubBuilder } from "@internal/device-session/model/Session.stub";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { SessionService } from "@internal/device-session/service/SessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { GetSessionDeviceStateUseCase } from "./GetSessionDeviceStateUseCase";

let logger: LoggerPublisherService;
let sessionService: SessionService;

const fakeSessionId = "fakeSessionId";

describe("GetSessionDeviceStateUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case-test",
    );
    sessionService = new DefaultSessionService(() => logger);
  });
  it("should retrieve session device state", () => {
    // given
    const session = sessionStubBuilder({ id: fakeSessionId });
    sessionService.addSession(session);
    const useCase = new GetSessionDeviceStateUseCase(
      sessionService,
      () => logger,
    );

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    // then
    expect(response).toStrictEqual(session.state);
  });

  it("should throw error when session is not found", () => {
    // given
    const useCase = new GetSessionDeviceStateUseCase(
      sessionService,
      () => logger,
    );

    // when
    const execute = () =>
      useCase.execute({
        sessionId: fakeSessionId,
      });

    // then
    expect(execute).toThrowError();
  });
});
