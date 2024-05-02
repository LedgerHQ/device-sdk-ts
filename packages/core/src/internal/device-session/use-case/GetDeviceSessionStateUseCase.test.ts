import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { GetDeviceSessionStateUseCase } from "./GetDeviceSessionStateUseCase";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;

const fakeSessionId = "fakeSessionId";

describe("GetDeviceSessionStateUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case-test",
    );
    sessionService = new DefaultDeviceSessionService(() => logger);
  });
  it("should retrieve deviceSession device state", () => {
    // given
    const deviceSession = deviceSessionStubBuilder({ id: fakeSessionId });
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetDeviceSessionStateUseCase(
      sessionService,
      () => logger,
    );

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    // then
    expect(response).toStrictEqual(deviceSession.state);
  });

  it("should throw error when deviceSession is not found", () => {
    // given
    const useCase = new GetDeviceSessionStateUseCase(
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
