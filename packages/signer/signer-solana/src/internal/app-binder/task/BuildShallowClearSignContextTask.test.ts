/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ClearSignContextType,
  type ContextModule,
  SolanaTransactionScanChainId,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

import {
  BuildShallowClearSignContextTask,
  type ShallowClearSignContext,
} from "./BuildShallowClearSignContextTask";

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
  signerAddress: null,
  options: {
    tokenAddress: "someAddress",
    createATA: undefined,
  },
};

const trustedNameSuccessContext = {
  type: ClearSignContextType.SOLANA_TRUSTED_NAME as const,
  payload: trustedNamePayload,
  certificate: trustedNameCert,
};

let apiMock: InternalApi;

describe("BuildShallowClearSignContextTask", () => {
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

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);
    await task.run();

    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );
  });

  it("calls contextModule.getContexts with the active Solana context types (transaction-check temporarily disabled)", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
    ]);

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);
    await task.run();

    expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
      {
        deviceModelId: DeviceModelId.NANO_X,
        tokenAddress: "someAddress",
        challenge: "someChallenge",
        createATA: undefined,
        tokenInternalId: undefined,
        templateId: undefined,
        transactionCheck: undefined,
      },
      [
        ClearSignContextType.SOLANA_TOKEN,
        ClearSignContextType.SOLANA_LIFI,
        ClearSignContextType.SOLANA_TRUSTED_NAME,
      ],
    );
  });

  it("derives transactionCheck from signerAddress and transactionBytes when address is provided", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
    ]);

    const argsWithSigner = {
      ...defaultArgs,
      signerAddress: "So1anaSignerPubKey111111111111111111111111111",
    };

    const task = new BuildShallowClearSignContextTask(apiMock, argsWithSigner);
    await task.run();

    expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionCheck: {
          from: "So1anaSignerPubKey111111111111111111111111111",
          transactionBytes: defaultArgs.transactionBytes,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      }),
      expect.any(Array),
    );
  });

  it("returns trustedName cert + tlvDescriptor when SOLANA_TRUSTED_NAME context is present", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
    ]);

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result).toEqual<ShallowClearSignContext>({
      tlvDescriptor: trustedNamePayload,
      trustedNamePKICertificate: trustedNameCert,
      loadersResults: [],
      contextErrorCount: 0,
    });
  });

  it("includes SOLANA_TRANSACTION_CHECK results in loadersResults", async () => {
    const txCheckContext = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: "aabbccdd" },
      certificate: { payload: new Uint8Array([0x99]), keyUsageNumber: 14 },
    };
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
      txCheckContext,
    ]);

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result.loadersResults).toEqual([txCheckContext]);
    expect(result.contextErrorCount).toBe(0);
  });

  it("includes SOLANA_TOKEN and SOLANA_LIFI results in loadersResults", async () => {
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

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result.loadersResults).toEqual([tokenContext, lifiContext]);
  });

  it("throws when challenge command fails", async () => {
    (apiMock.sendCommand as any).mockResolvedValue(
      CommandResultFactory({
        error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" } as any,
      }),
    );

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow(
      "Failed to get challenge from device",
    );
  });

  it("counts ERROR contexts and surfaces them via contextErrorCount and loadersResults", async () => {
    const error = new Error("token loader failure");
    (contextModuleMock.getContexts as any).mockResolvedValue([
      trustedNameSuccessContext,
      { type: ClearSignContextType.ERROR, error },
    ]);

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(result.trustedNamePKICertificate).toEqual(trustedNameCert);
    expect(result.tlvDescriptor).toEqual(trustedNamePayload);
    expect(result.contextErrorCount).toBe(1);
    expect(result.loadersResults).toEqual([
      { type: ClearSignContextType.ERROR, error },
    ]);
  });

  it("returns empty trusted-name fields when owner info is not required and only errors are returned", async () => {
    const error = new Error("solana context failure");
    const argsWithoutOwnerInfo = {
      ...defaultArgs,
      options: { tokenAddress: undefined, createATA: undefined },
    };
    (contextModuleMock.getContexts as any).mockResolvedValue([
      { type: ClearSignContextType.ERROR, error },
    ]);

    const task = new BuildShallowClearSignContextTask(
      apiMock,
      argsWithoutOwnerInfo,
    );
    const result = await task.run();

    expect(result.trustedNamePKICertificate).toBeUndefined();
    expect(result.tlvDescriptor).toBeUndefined();
    expect(result.contextErrorCount).toBe(1);
    expect(result.loadersResults).toEqual([
      { type: ClearSignContextType.ERROR, error },
    ]);
  });

  it("throws when owner info is required but no SOLANA_TRUSTED_NAME context was returned", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([
      {
        type: ClearSignContextType.ERROR,
        error: new Error("PKI cert load failure"),
      },
    ]);

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow(
      "[SignerSolana] BuildShallowClearSignContextTask: owner info was required but could not be resolved",
    );
  });

  it("throws when owner info is required but contextModule returns an empty array", async () => {
    (contextModuleMock.getContexts as any).mockResolvedValue([]);

    const task = new BuildShallowClearSignContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow(
      "[SignerSolana] BuildShallowClearSignContextTask: owner info was required but could not be resolved",
    );
  });
});
