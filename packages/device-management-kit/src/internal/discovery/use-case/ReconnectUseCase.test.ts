import { type DeviceModelId } from "@api/device/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type ConnectedDevice } from "@api/transport/model/ConnectedDevice";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { type ConnectUseCase } from "./ConnectUseCase";
import { type DisconnectUseCase } from "./DisconnectUseCase";
import { ReconnectUseCase } from "./ReconnectUseCase";

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("newSessionId"),
}));

let logger: LoggerPublisherService;
let connectUseCase: ConnectUseCase;
let disconnectUseCase: DisconnectUseCase;

const newSessionId = "newSessionId";

describe("ReconnectUseCase", () => {
  const stubConnectedDevice = {
    sessionId: "session-id",
    id: "device-id",
    transport: "USB",
    type: "MOCK" as unknown as ConnectionType,
    modelId: "model-id" as unknown as DeviceModelId,
    name: "device-name",
  };
  const tag = "logger-tag";

  beforeAll(() => {
    logger = new DefaultLoggerPublisherService([], tag);
    connectUseCase = {} as ConnectUseCase;
    disconnectUseCase = {} as DisconnectUseCase;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test("Should successfully reconnect device session (disconnect then connect)", async () => {
    // Given
    connectUseCase.execute = vi.fn().mockResolvedValue(newSessionId);
    disconnectUseCase.execute = vi.fn().mockResolvedValue(undefined);

    const usecase = new ReconnectUseCase(
      connectUseCase,
      disconnectUseCase,
      () => logger,
    );

    // When
    const sessionId = await usecase.execute({
      device: stubConnectedDevice,
    });

    // Then
    expect(disconnectUseCase.execute).toHaveBeenCalledWith({
      sessionId: stubConnectedDevice.sessionId,
    });
    expect(connectUseCase.execute).toHaveBeenCalledWith({
      device: stubConnectedDevice,
      sessionRefresherOptions: undefined,
    });
    expect(sessionId).toBe(newSessionId);
  });

  test("Should throw an error when disconnect fails", async () => {
    // Given
    const disconnectError = new Error("Disconnect failed");
    disconnectUseCase.execute = vi.fn().mockRejectedValue(disconnectError);
    connectUseCase.execute = vi.fn();

    const usecase = new ReconnectUseCase(
      connectUseCase,
      disconnectUseCase,
      () => logger,
    );

    // When / Then
    await expect(
      usecase.execute({
        device: stubConnectedDevice as unknown as ConnectedDevice,
      }),
    ).rejects.toThrow(disconnectError);
    expect(disconnectUseCase.execute).toHaveBeenCalled();
    expect(connectUseCase.execute).not.toHaveBeenCalled();
  });

  test("Should throw an error when connect fails after successful disconnect", async () => {
    // Given
    const connectError = new Error("Connect failed");
    disconnectUseCase.execute = vi.fn().mockResolvedValue(undefined);
    connectUseCase.execute = vi.fn().mockRejectedValue(connectError);

    const usecase = new ReconnectUseCase(
      connectUseCase,
      disconnectUseCase,
      () => logger,
    );

    // When / Then
    await expect(
      usecase.execute({
        device: stubConnectedDevice as unknown as ConnectedDevice,
      }),
    ).rejects.toThrow(connectError);
    expect(disconnectUseCase.execute).toHaveBeenCalled();
    expect(connectUseCase.execute).toHaveBeenCalled();
  });
});
