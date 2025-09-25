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
} as unknown as ContextModule;

const defaultArgs = {
  contextModule: contextModuleMock,
  options: {
    tokenAddress: "someAddress",
    createATA: undefined,
  },
};

const solanaContextRightPayload = {
  tlvDescriptor: new Uint8Array([1, 2, 3]),
  trustedNamePKICertificate: {
    payload: new Uint8Array([0xaa, 0xbb]),
    keyUsageNumber: 1,
  },
  loadersResults: [], // required by the task's return type
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
      Right(solanaContextRightPayload),
    );

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);
    const result = await task.run();

    // challenge is fetched
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );

    // getSolanaContext called with challenge
    expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.NANO_X,
      tokenAddress: "someAddress",
      challenge: "someChallenge",
      createATA: undefined,
    });

    // matches SolanaBuildContextResult shape
    expect(result).toEqual<SolanaBuildContextResult>({
      tlvDescriptor: solanaContextRightPayload.tlvDescriptor,
      trustedNamePKICertificate:
        solanaContextRightPayload.trustedNamePKICertificate,
      loadersResults: [],
    });
  });

  it("returns context when challenge command fails (challenge undefined)", async () => {
    (apiMock.sendCommand as any).mockResolvedValue({
      status: CommandResultStatus.Error,
      data: {},
    });
    (contextModuleMock.getSolanaContext as any).mockResolvedValue(
      Right(solanaContextRightPayload),
    );

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);
    const result = await task.run();

    // getSolanaContext called without challenge
    expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.NANO_X,
      tokenAddress: "someAddress",
      challenge: undefined,
      createATA: undefined,
    });

    expect(result).toEqual<SolanaBuildContextResult>({
      tlvDescriptor: solanaContextRightPayload.tlvDescriptor,
      trustedNamePKICertificate:
        solanaContextRightPayload.trustedNamePKICertificate,
      loadersResults: [],
    });
  });

  it("throws if getSolanaContext returns Left", async () => {
    const error = new Error("Solana context failure");
    (contextModuleMock.getSolanaContext as any).mockResolvedValue(Left(error));

    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    await expect(task.run()).rejects.toThrow("Solana context failure");
  });
});
