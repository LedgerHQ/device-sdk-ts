import * as uuid from "uuid";

import { sessionStubBuilder } from "@internal/device-session/model/Session.stub";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { SessionService } from "@internal/device-session/service/SessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { GetConnectedDeviceUseCase } from "@internal/usb/use-case/GetConnectedDeviceUseCase";

jest.mock("uuid");

let logger: LoggerPublisherService;
let sessionService: SessionService;

const fakeSessionId = "fakeSessionId";

describe("GetConnectedDevice", () => {
  beforeAll(() => {
    jest.spyOn(uuid, "v4").mockReturnValue(fakeSessionId);
  });
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case",
    );
    sessionService = new DefaultSessionService(() => logger);
  });

  it("should retrieve correct device from session", () => {
    // given
    const session = sessionStubBuilder();
    sessionService.addSession(session);
    const useCase = new GetConnectedDeviceUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
    });

    // then
    expect(session.connectedDevice).toStrictEqual(response);
  });
});
