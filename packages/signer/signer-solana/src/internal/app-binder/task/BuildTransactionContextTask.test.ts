import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultStatus,
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

import { BuildTransactionContextTask } from "./BuildTransactionContextTask";

const contextModuleMock: ContextModule = {
  getSolanaContext: vi.fn(),
  getContext: vi.fn(),
  getContexts: vi.fn(),
  getTypedDataFilters: vi.fn(),
  getWeb3Checks: vi.fn(),
};

const defaultArgs = {
  contextModule: contextModuleMock,
  options: {
    tokenAddress: "someAddress",
    createATA: undefined,
  },
};

const solanaContextResult = {
  descriptor: new Uint8Array([1, 2, 3]),
  certificate: {
    payload: new Uint8Array([0xaa, 0xbb]),
    keyUsageNumber: 1,
  },
  tokenAccount: "someTokenAccount",
  owner: "someOwner",
  contract: "someContract",
};

let apiMock: InternalApi;

describe("BuildTransactionContextTask", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    apiMock = {
      getDeviceSessionState: vi.fn().mockReturnValue({
        deviceModelId: DeviceModelId.NANO_X,
      }),
      sendCommand: vi.fn().mockResolvedValue({
        status: CommandResultStatus.Success,
        data: { challenge: "someChallenge" },
      }),
    } as unknown as InternalApi;
  });

  it("should return a context with challenge and descriptor", async () => {
    // GIVEN
    (apiMock.sendCommand as Mock).mockResolvedValue({
      status: CommandResultStatus.Success,
      data: { challenge: "someChallenge" },
    });

    (contextModuleMock.getSolanaContext as Mock).mockResolvedValue(
      solanaContextResult,
    );

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    // WHEN
    const result = await task.run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );
    expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.NANO_X,
      tokenAddress: "someAddress",
      challenge: "someChallenge",
      createATA: undefined,
    });

    expect(result).toEqual({
      challenge: "someChallenge",
      descriptor: solanaContextResult.descriptor,
      calCertificate: solanaContextResult.certificate,
      addressResult: {
        tokenAccount: "someTokenAccount",
        owner: "someOwner",
        contract: "someContract",
      },
    });
  });

  it("should skip challenge for Nano S", async () => {
    // GIVEN
    (apiMock.getDeviceSessionState as Mock).mockReturnValue({
      deviceModelId: DeviceModelId.NANO_S,
    });

    (contextModuleMock.getSolanaContext as Mock).mockResolvedValue(
      solanaContextResult,
    );

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    // WHEN
    const result = await task.run();

    // THEN
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
    expect(result.challenge).toBeUndefined();
  });

  it("should throw if challenge command fails", async () => {
    // GIVEN
    (apiMock.sendCommand as Mock).mockResolvedValue({
      status: CommandResultStatus.Error,
      data: {},
    });

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    // WHEN / THEN
    await expect(task.run()).rejects.toThrow(
      "[signer-solana] - BuildTransactionContextTask: Failed to get challenge from device.",
    );
  });

  it("should throw if solana context is null", async () => {
    // GIVEN
    (apiMock.sendCommand as Mock).mockResolvedValue({
      status: CommandResultStatus.Success,
      data: { challenge: "someChallenge" },
    });

    (contextModuleMock.getSolanaContext as Mock).mockResolvedValue(null);

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    // WHEN / THEN
    await expect(task.run()).rejects.toThrow(
      "[signer-solana] - BuildTransactionContextTask: Solana context not available",
    );
  });
});
