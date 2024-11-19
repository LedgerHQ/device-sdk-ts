import { Left } from "purify-ts";

import { type Command } from "@api/command/Command";
import { CommandResultStatus } from "@api/command/model/CommandResult";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { SendCommandUseCase } from "./SendCommandUseCase";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApi: ManagerApiService;
let managerApiDataSource: ManagerApiDataSource;
const fakeSessionId = "fakeSessionId";
let command: Command<{ status: string }>;

describe("SendCommandUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-command-use-case");
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    command = {
      getApdu: jest.fn(),
      parseResponse: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send a command to a connected device", async () => {
    const deviceSession = deviceSessionStubBuilder(
      {},
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new SendCommandUseCase(sessionService, () => logger);

    jest.spyOn(deviceSession, "sendCommand").mockResolvedValue({
      status: CommandResultStatus.Success,
      data: undefined,
    });

    const response = await useCase.execute<{ status: string }, void, void>({
      sessionId: fakeSessionId,
      command,
    });

    deviceSession.close();

    expect(response).toStrictEqual({
      status: CommandResultStatus.Success,
      data: undefined,
    });
  });

  it("should throw an error if the session is not found", async () => {
    const useCase = new SendCommandUseCase(sessionService, () => logger);
    jest
      .spyOn(sessionService, "getDeviceSessionById")
      .mockReturnValue(Left({ _tag: "DeviceSessionNotFound" }));

    const res = useCase.execute<{ status: string }, void, void>({
      sessionId: fakeSessionId,
      command,
    });

    await expect(res).rejects.toMatchObject({ _tag: "DeviceSessionNotFound" });
  });
});
