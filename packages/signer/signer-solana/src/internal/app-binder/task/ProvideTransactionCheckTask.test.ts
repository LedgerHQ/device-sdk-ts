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
import { ProvideTransactionCheckCommand } from "@internal/app-binder/command/ProvideTransactionCheckCommand";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";
import { type SolanaTransactionSerializer } from "@internal/app-binder/services/SolanaTransactionSerializer";

import { ProvideTransactionCheckTask } from "./ProvideTransactionCheckTask";

const SIGNER = "So1anaSignerPubKey111111111111111111111111111";
const TX = new Uint8Array([1, 2, 3]);
const WRAPPED = new Uint8Array([0x42, 0x43]);

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
  serializedTransactionForTransactionCheck?: Uint8Array,
  transactionSerializer: SolanaTransactionSerializer = {
    wrapMessageAsTransaction: vi.fn().mockReturnValue(WRAPPED),
  },
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
  const task = new ProvideTransactionCheckTask(api as any, {
    derivationPath: "44'/501'/0'",
    transactionBytes,
    contextModule,
    isBlockhashRefreshNeeded,
    serializedTransactionForTransactionCheck,
    transactionSerializer,
    loggerFactory: () =>
      ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any,
  });
  return { task, api, getContexts, transactionSerializer };
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
          transactionBytes: WRAPPED,
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

  it("zeroes the blockhash before wrapping when the sign will refresh it (delayed path)", async () => {
    const message = buildLegacyMessage();
    const expected = new BlockhashService().zeroBlockhash(message);
    const getContexts = vi.fn(async () => [txCheckContext]);
    const serializerMock: SolanaTransactionSerializer = {
      wrapMessageAsTransaction: vi.fn().mockReturnValue(WRAPPED),
    };
    const { task } = makeTask(
      getContexts,
      message,
      true,
      undefined,
      serializerMock,
    );

    await task.run();

    expect(serializerMock.wrapMessageAsTransaction).toHaveBeenCalledWith(
      expected,
      undefined,
    );
  });

  it("wraps the original bytes when the sign will not refresh the blockhash (one-shot path)", async () => {
    const message = buildLegacyMessage();
    const getContexts = vi.fn(async () => [txCheckContext]);
    const serializerMock: SolanaTransactionSerializer = {
      wrapMessageAsTransaction: vi.fn().mockReturnValue(WRAPPED),
    };
    const { task } = makeTask(
      getContexts,
      message,
      false,
      undefined,
      serializerMock,
    );

    await task.run();

    expect(serializerMock.wrapMessageAsTransaction).toHaveBeenCalledWith(
      message,
      undefined,
    );
  });

  it("forwards serializedTransactionForTransactionCheck to the serializer", async () => {
    const blob = new Uint8Array([0xde, 0xad]);
    const getContexts = vi.fn(async () => [txCheckContext]);
    const serializerMock: SolanaTransactionSerializer = {
      wrapMessageAsTransaction: vi.fn().mockReturnValue(WRAPPED),
    };
    const { task } = makeTask(getContexts, TX, false, blob, serializerMock);

    await task.run();

    expect(serializerMock.wrapMessageAsTransaction).toHaveBeenCalledWith(
      TX,
      blob,
    );
  });

  it("zeroes transactionBytes before wrapping when isBlockhashRefreshNeeded and serializedTransactionForTransactionCheck is supplied", async () => {
    const message = buildLegacyMessage();
    const blob = new Uint8Array([0xde, 0xad]);
    const getContexts = vi.fn(async () => [txCheckContext]);
    const serializerMock: SolanaTransactionSerializer = {
      wrapMessageAsTransaction: vi.fn().mockReturnValue(WRAPPED),
    };
    const { task } = makeTask(getContexts, message, true, blob, serializerMock);

    await task.run();

    const expected = new BlockhashService().zeroBlockhash(message);
    expect(serializerMock.wrapMessageAsTransaction).toHaveBeenCalledWith(
      expected,
      blob,
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
