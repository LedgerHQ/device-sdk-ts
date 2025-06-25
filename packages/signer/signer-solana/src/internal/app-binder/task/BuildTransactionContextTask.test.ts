/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultStatus,
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

import {
  BuildTransactionContextTask,
  type SolanaBuildContextResult,
} from "./BuildTransactionContextTask";

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

const domainSolanaPayload = {
  descriptor: new Uint8Array([1, 2, 3]),
  tokenAccount: "someTokenAccount",
  owner: "someOwner",
  contract: "someContract",
  certificate: { payload: new Uint8Array([0xaa, 0xbb]), keyUsageNumber: 1 },
} as const;

let apiMock: InternalApi;

describe("BuildTransactionContextTask", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    apiMock = {
      getDeviceSessionState: vi
        .fn()
        .mockReturnValue({ deviceModelId: DeviceModelId.NANO_X }),
      sendCommand: vi.fn().mockResolvedValue({
        status: CommandResultStatus.Success,
        data: { challenge: "someChallenge" },
      }),
    } as unknown as InternalApi;
  });

  it("returns context successfully when challenge command succeeds", async () => {
    (contextModuleMock.getSolanaContext as any).mockResolvedValue(
      Right(domainSolanaPayload),
    );

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );

    expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.NANO_X,
      tokenAddress: "someAddress",
      challenge: "someChallenge",
      createATA: undefined,
    });

    expect(result).toEqual<SolanaBuildContextResult>({
      challenge: "someChallenge",
      descriptor: domainSolanaPayload.descriptor,
      calCertificate: domainSolanaPayload.certificate,
      addressResult: {
        tokenAccount: domainSolanaPayload.tokenAccount,
        owner: domainSolanaPayload.owner,
        contract: domainSolanaPayload.contract,
      },
    });
  });

  it("returns context when challenge command fails", async () => {
    (apiMock.sendCommand as any).mockResolvedValue({
      status: CommandResultStatus.Error,
      data: {},
    });
    (contextModuleMock.getSolanaContext as any).mockResolvedValue(
      Right(domainSolanaPayload),
    );

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);
    const result = await task.run();

    expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.NANO_X,
      tokenAddress: "someAddress",
      challenge: undefined,
      createATA: undefined,
    });

    expect(result).toEqual<SolanaBuildContextResult>({
      challenge: undefined,
      descriptor: domainSolanaPayload.descriptor,
      calCertificate: domainSolanaPayload.certificate,
      addressResult: {
        tokenAccount: domainSolanaPayload.tokenAccount,
        owner: domainSolanaPayload.owner,
        contract: domainSolanaPayload.contract,
      },
    });
  });

  it("throws if getSolanaContext returns Left", async () => {
    const error = new Error("Solana context failure");
    (contextModuleMock.getSolanaContext as any).mockResolvedValue(Left(error));

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow("Solana context failure");
  });
});
