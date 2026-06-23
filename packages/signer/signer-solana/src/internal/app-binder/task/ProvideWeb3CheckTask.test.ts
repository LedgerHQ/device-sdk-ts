/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ClearSignContextType,
  SolanaTransactionScanChainId,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
} from "@ledgerhq/device-management-kit";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { ProvideWeb3CheckTask } from "./ProvideWeb3CheckTask";

const SIGNER = "So1anaSignerPubKey111111111111111111111111111";
const TX = new Uint8Array([1, 2, 3]);

const BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";
const payer = new PublicKey("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const recipient = new PublicKey("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");

/** A real legacy Solana message with a non-zero recent blockhash. */
function buildLegacyMessage(): Uint8Array {
  const tx = new Transaction({ recentBlockhash: BLOCKHASH, feePayer: payer });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports: 1_000_000,
    }),
  );
  return Uint8Array.from(tx.serializeMessage());
}

const txCheckContext = {
  type: ClearSignContextType.SOLANA_TRANSACTION_CHECK,
  payload: { descriptor: "aabbccdd" },
  certificate: { payload: new Uint8Array([0x99]), keyUsageNumber: 14 },
} as any;

function makeTask(
  getContexts: Mock = vi.fn(async () => [txCheckContext]),
  transactionBytes: Uint8Array = TX,
  isBlockhashRefreshNeeded = true,
) {
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
  const task = new ProvideWeb3CheckTask(api as any, {
    derivationPath: "44'/501'/0'",
    transactionBytes,
    contextModule,
    isBlockhashRefreshNeeded,
    loggerFactory: () =>
      ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any,
  });
  return { task, api, getContexts };
}

describe("ProvideWeb3CheckTask", () => {
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
          // Blockhash can't be located in this 3-byte fixture, so the task
          // falls back to the original bytes (best-effort).
          transactionBytes: TX,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      }),
      [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
    );
    // Descriptor was dispatched to the device.
    const sent = api.sendCommand.mock.calls.map((c) => c[0]);
    expect(sent.some((c) => c instanceof ProvideWeb3CheckCommand)).toBe(true);
  });

  it("zeroes the blockhash when the sign will refresh it (delayed path)", async () => {
    // The delayed path previews a blockhash-zeroed message, so the backend must
    // scan the same bytes — otherwise the verdict can't be matched on-device and
    // it shows "Transaction Check unavailable".
    const message = buildLegacyMessage();
    const expected = new BlockhashService().zeroBlockhash(message);
    const getContexts = vi.fn(async () => [txCheckContext]);
    const { task } = makeTask(getContexts, message, true);

    await task.run();

    const sentBytes = (getContexts.mock.calls[0] as any)[0].transactionCheck
      .transactionBytes as Uint8Array;
    expect(sentBytes).toEqual(expected);
    // The original (non-zeroed) message must not be forwarded as-is.
    expect(sentBytes).not.toEqual(message);
  });

  it("keeps the original blockhash when the sign will not refresh it (one-shot path)", async () => {
    // The one-shot path signs the original message, so the device fingerprints
    // the real blockhash; zeroing it here would make the verdict unmatchable.
    const message = buildLegacyMessage();
    const getContexts = vi.fn(async () => [txCheckContext]);
    const { task } = makeTask(getContexts, message, false);

    await task.run();

    const sentBytes = (getContexts.mock.calls[0] as any)[0].transactionCheck
      .transactionBytes as Uint8Array;
    expect(sentBytes).toEqual(message);
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
