import { Left } from "purify-ts";

import { Command } from "@api/command/Command";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { SendCommandUseCase } from "./SendCommandUseCase";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
const fakeSessionId = "fakeSessionId";
let command: Command<{ status: string }>;

describe("SendCommandUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-command-use-case");
    sessionService = new DefaultDeviceSessionService(() => logger);
    command = {
      getApdu: jest.fn(),
      parseResponse: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send a command to a connected device", async () => {
    const deviceSession = deviceSessionStubBuilder({}, () => logger);
    sessionService.addDeviceSession(deviceSession);
    const useCase = new SendCommandUseCase(sessionService, () => logger);

    jest
      .spyOn(deviceSession, "sendCommand")
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
      .spyOn(sessionService, "getDeviceSessionById")
      .mockReturnValue(Left({ _tag: "DeviceSessionNotFound" }));

    const res = useCase.execute<{ status: string }>({
      sessionId: fakeSessionId,
      command,
      params: undefined,
    });

    await expect(res).rejects.toMatchObject({ _tag: "DeviceSessionNotFound" });
  });
});
