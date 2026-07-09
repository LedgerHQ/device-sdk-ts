/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

import {
  type BasicClearSignContext,
  BuildBasicClearSignContextTask,
} from "./BuildBasicClearSignContextTask";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const contextModuleMock: ContextModule = {
  getContexts: vi.fn(),
} as unknown as ContextModule;

const trustedNamePayload = new Uint8Array([1, 2, 3]);
const trustedNameCert = {
  payload: new Uint8Array([0xaa, 0xbb]),
  keyUsageNumber: 1,
};

const defaultArgs = {
  contextModule: contextModuleMock,
  loggerFactory: mockLoggerFactory,
  transactionBytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  options: {
    tokenAddress: "someAddress",
    createATA: undefined,
  },
};

const trustedNameSuccessContext = {
  type: ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME as const,
  payload: trustedNamePayload,
  certificate: trustedNameCert,
};

let apiMock: InternalApi;

describe("BuildBasicClearSignContextTask", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    apiMock = {
      getDeviceSessionState: vi
        .fn()
        .mockReturnValue({ deviceModelId: DeviceModelId.NANO_X }),
      sendCommand: vi
        .fn()
        .mockResolvedValue(
          CommandResultFactory({ data: { challenge: "someChallenge" } }),
        ),
    } as unknown as InternalApi;
  });

  it("requests the challenge from the device", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
    ]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);
    await task.run();

    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );
  });

  it("calls contextModule.getContexts with the active Solana context types", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
    ]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);
    await task.run();

    expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
      {
        deviceModelId: DeviceModelId.NANO_X,
        tokenAddress: "someAddress",
        challenge: "someChallenge",
        createATA: undefined,
        tokenInternalId: undefined,
        templateId: undefined,
      },
      [
        ClearSignContextType.SOLANA_TOKEN,
        ClearSignContextType.SOLANA_LIFI,
        ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
      ],
    );
  });

  it("includes SOLANA_BASIC_TRUSTED_NAME in loadersResults when present", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
    ]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result).toEqual<BasicClearSignContext>({
      loadersResults: [trustedNameSuccessContext],
      contextErrorCount: 0,
    });
  });

  it("includes SOLANA_BASIC_TRUSTED_NAME, SOLANA_TOKEN, and SOLANA_LIFI in loadersResults", async () => {
    const tokenContext = {
      type: ClearSignContextType.SOLANA_TOKEN as const,
      payload: { solanaTokenDescriptor: { data: "aa", signature: "bb" } },
      certificate: undefined,
    };
    const lifiContext = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: { descriptors: {}, instructions: [] },
      certificate: undefined,
    };
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
      tokenContext,
      lifiContext,
    ]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result.loadersResults).toEqual([
      trustedNameSuccessContext,
      tokenContext,
      lifiContext,
    ]);
  });

  it("throws when challenge command fails", async () => {
    (apiMock.sendCommand as any).mockResolvedValue(
      CommandResultFactory({
        error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" } as any,
      }),
    );

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow(
      "Failed to get challenge from device",
    );
  });

  it("counts ERROR contexts via contextErrorCount but excludes them from loadersResults", async () => {
    const error = new Error("token loader failure");
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
      { type: ClearSignContextType.ERROR, error },
    ]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result.contextErrorCount).toBe(1);
    expect(result.loadersResults).toEqual([trustedNameSuccessContext]);
  });

  it("omits SOLANA_BASIC_TRUSTED_NAME and errors from loadersResults when owner info is not required", async () => {
    const error = new Error("solana context failure");
    const argsWithoutOwnerInfo = {
      ...defaultArgs,
      options: { tokenAddress: undefined, createATA: undefined },
    };
    (contextModuleMock.getContexts as any).mockResolvedValue([
      { type: ClearSignContextType.ERROR, error },
    ]);

    const task = new BuildBasicClearSignContextTask(
      apiMock,
      argsWithoutOwnerInfo,
    );
    const result = await task.run();

    expect(result.contextErrorCount).toBe(1);
    expect(result.loadersResults).toEqual([]);
  });

  it("throws when owner info is required but no SOLANA_BASIC_TRUSTED_NAME context was returned", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      {
        type: ClearSignContextType.ERROR,
        error: new Error("PKI cert load failure"),
      },
    ]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow(
      "[SignerSolana] BuildBasicClearSignContextTask: owner info was required but could not be resolved",
    );
  });

  it("throws when owner info is required but contextModule returns an empty array", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([]);

    const task = new BuildBasicClearSignContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow(
      "[SignerSolana] BuildBasicClearSignContextTask: owner info was required but could not be resolved",
    );
  });
});
