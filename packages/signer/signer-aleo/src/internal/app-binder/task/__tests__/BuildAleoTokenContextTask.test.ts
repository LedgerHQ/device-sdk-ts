import {
  AleoContextTypes,
  type AleoTransactionContextResult,
  type ContextModule,
} from "@ledgerhq/context-module";
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/task/__test-utils__/makeInternalApi";
import { BuildAleoTokenContextTask } from "@internal/app-binder/task/BuildAleoTokenContextTask";

const DEVICE_MODEL_ID = DeviceModelId.FLEX;

const makeContextModule = (): ContextModule =>
  ({
    getAleoContext: vi.fn(),
    getContexts: vi.fn(),
    getFieldContext: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getSolanaContext: vi.fn(),
    report: vi.fn(),
  }) as unknown as ContextModule;

describe("BuildAleoTokenContextTask", () => {
  let mockContextModule: ContextModule;
  const apiMock = makeDeviceActionInternalApiMock();

  const successResult: AleoTransactionContextResult = {
    loadersResults: [
      {
        type: AleoContextTypes.ALEO_TOKEN,
        payload: {
          aleoTokenDescriptor: { data: "ABCD", signature: "SIG" },
        },
        certificate: { keyUsageNumber: 8, payload: new Uint8Array([1, 2, 3]) },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContextModule = makeContextModule();
    apiMock.getDeviceSessionState.mockReturnValue({
      deviceModelId: DEVICE_MODEL_ID,
    } as ReturnType<typeof apiMock.getDeviceSessionState>);
  });

  it("calls contextModule.getAleoContext with tokenInternalId and deviceModelId from session state", async () => {
    // given
    vi.mocked(mockContextModule.getAleoContext).mockResolvedValue(
      successResult,
    );

    const task = new BuildAleoTokenContextTask(apiMock, {
      contextModule: mockContextModule,
      tokenInternalId: "aleo:usdc",
    });

    // when
    const result = await task.run();

    // then
    expect(mockContextModule.getAleoContext).toHaveBeenCalledTimes(1);
    expect(mockContextModule.getAleoContext).toHaveBeenCalledWith({
      tokenInternalId: "aleo:usdc",
      programName: undefined,
      deviceModelId: DEVICE_MODEL_ID,
    });
    expect(result).toEqual(successResult);
  });

  it("forwards programName to contextModule.getAleoContext when provided", async () => {
    // given
    vi.mocked(mockContextModule.getAleoContext).mockResolvedValue(
      successResult,
    );

    const task = new BuildAleoTokenContextTask(apiMock, {
      contextModule: mockContextModule,
      tokenInternalId: "aleo:usdc",
      programName: "token_registry.aleo",
    });

    // when
    await task.run();

    // then
    expect(mockContextModule.getAleoContext).toHaveBeenCalledWith({
      tokenInternalId: "aleo:usdc",
      programName: "token_registry.aleo",
      deviceModelId: DEVICE_MODEL_ID,
    });
  });

  it("propagates rejection from contextModule.getAleoContext", async () => {
    // given
    const error = new Error("CAL fetch failed");
    vi.mocked(mockContextModule.getAleoContext).mockRejectedValue(error);

    const task = new BuildAleoTokenContextTask(apiMock, {
      contextModule: mockContextModule,
      tokenInternalId: "aleo:usdc",
    });

    // when / then
    await expect(task.run()).rejects.toThrow("CAL fetch failed");
  });

  it("returns the full AleoTransactionContextResult including loadersResults", async () => {
    // given
    vi.mocked(mockContextModule.getAleoContext).mockResolvedValue(
      successResult,
    );

    const task = new BuildAleoTokenContextTask(apiMock, {
      contextModule: mockContextModule,
      tokenInternalId: "aleo:usdc",
    });

    // when
    const result = await task.run();

    // then
    expect(result.loadersResults).toHaveLength(1);
    expect(result.loadersResults[0]?.type).toBe(AleoContextTypes.ALEO_TOKEN);
  });
});
