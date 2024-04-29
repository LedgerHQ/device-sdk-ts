import { Left } from "purify-ts";

import { Command } from "@api/command/Command";
import { sessionStubBuilder } from "@internal/device-session/model/Session.stub";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { SessionService } from "@internal/device-session/service/SessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import {
  SendCommandUseCase,
  // SendCommandUseCaseArgs,
} from "./SendCommandUseCase";

let logger: LoggerPublisherService;
let sessionService: SessionService;
const fakeSessionId = "fakeSessionId";
let command: Command<{ status: string }>;

describe("SendCommandUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-command-use-case");
    sessionService = new DefaultSessionService(() => logger);
    command = {
      getApdu: jest.fn(),
      parseResponse: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send a command to a connected device", async () => {
    const session = sessionStubBuilder();
    sessionService.addSession(session);
    const useCase = new SendCommandUseCase(sessionService, () => logger);

    jest
      .spyOn(session, "getCommand")
      .mockReturnValue(async () => Promise.resolve({ status: "success" }));

    const response = await useCase.execute<{ status: string }>({
      sessionId: fakeSessionId,
      command,
      params: undefined,
    });

    expect(response).toStrictEqual({ status: "success" });
  });

  it("should throw an error if the session is not found", async () => {
    const useCase = new SendCommandUseCase(sessionService, () => logger);
    jest
      .spyOn(sessionService, "getSessionById")
      .mockReturnValue(Left({ _tag: "DeviceSessionNotFound" }));

    const res = useCase.execute<{ status: string }>({
      sessionId: fakeSessionId,
      command,
      params: undefined,
    });

    await expect(res).rejects.toMatchObject({ _tag: "DeviceSessionNotFound" });
  });
});
