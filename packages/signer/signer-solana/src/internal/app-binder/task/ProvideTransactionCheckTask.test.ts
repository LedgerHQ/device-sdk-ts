/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ClearSignContextType,
  SolanaTransactionScanChainId,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import { ProvideTransactionCheckCommand } from "@internal/app-binder/command/ProvideTransactionCheckCommand";

import { ProvideTransactionCheckTask } from "./ProvideTransactionCheckTask";

const SIGNER = "So1anaSignerPubKey111111111111111111111111111";
const TX = new Uint8Array([1, 2, 3]);

const txCheckContext = {
  type: ClearSignContextType.SOLANA_TRANSACTION_CHECK,
  payload: { descriptor: "aabbccdd" },
  certificate: { payload: new Uint8Array([0x99]), keyUsageNumber: 14 },
} as any;

function makeTask(getContexts: Mock = vi.fn(async () => [txCheckContext])) {
  const api = {
    sendCommand: vi.fn(async (cmd: unknown) => {
      if (cmd instanceof GetPubKeyCommand)
        return CommandResultFactory({ data: SIGNER });
      if (cmd instanceof GetChallengeCommand)
        return CommandResultFactory({ data: { challenge: "deadbeef" } });
      return CommandResultFactory({ data: undefined });
    }),
    getDeviceSessionState: vi.fn(() => ({ deviceModelId: DeviceModelId.STAX })),
  };
  const contextModule = { getContexts } as any;
  const task = new ProvideTransactionCheckTask(api as any, {
    derivationPath: "44'/501'/0'",
    transactionBytes: TX,
    contextModule,
    loggerFactory: () =>
      ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any,
  });
  return { task, api, getContexts };
}

describe("ProvideTransactionCheckTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the scan descriptor (pubkey + fresh challenge) and streams it", async () => {
    const { task, api, getContexts } = makeTask();

    await task.run();

    expect(api.sendCommand).toHaveBeenCalledWith(expect.any(GetPubKeyCommand));
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        challenge: "deadbeef",
        transactionCheck: {
          from: SIGNER,
          transactionBytes: TX,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      }),
      [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
    );
    // Descriptor was dispatched to the device.
    const sent = api.sendCommand.mock.calls.map((c) => c[0]);
    expect(sent.some((c) => c instanceof ProvideTransactionCheckCommand)).toBe(
      true,
    );
  });

  it("skips (best-effort) when the public key cannot be read", async () => {
    const { task, api, getContexts } = makeTask();
    api.sendCommand.mockImplementation(async (cmd: unknown) =>
      cmd instanceof GetPubKeyCommand
        ? CommandResultFactory({
            error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
          })
        : CommandResultFactory({ data: { challenge: "deadbeef" } }),
    );

    await expect(task.run()).resolves.toBeUndefined();
    expect(getContexts).not.toHaveBeenCalled();
  });

  it("skips (best-effort) when GET CHALLENGE fails", async () => {
    const { task, api, getContexts } = makeTask();
    api.sendCommand.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof GetPubKeyCommand)
        return CommandResultFactory({ data: SIGNER });
      return CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      });
    });

    await expect(task.run()).resolves.toBeUndefined();
    expect(getContexts).not.toHaveBeenCalled();
  });
});
