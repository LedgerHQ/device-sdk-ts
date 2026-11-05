/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  MessageV0,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideGatedSigningCommand } from "@internal/app-binder/command/ProvideGatedSigningCommand";

import { ProvideGatedSigningTask } from "./ProvideGatedSigningTask";

const BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";
const payer = new PublicKey("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const recipient = new PublicKey("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");
const PARTNER = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const ROUTE = new Uint8Array([0xe5, 0x17, 0xcb, 0x97, 0x7a, 0xe3, 0xad, 0x2a]);
const SWAP_DATA = new Uint8Array([...ROUTE, 0x01, 0x02]);

const partnerSwap = (keys: PublicKey[] = [payer]) =>
  new TransactionInstruction({
    programId: PARTNER,
    keys: keys.map((pubkey) => ({
      pubkey,
      isSigner: pubkey.equals(payer),
      isWritable: true,
    })),
    data: Buffer.from(SWAP_DATA),
  });

const tip = () =>
  SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: recipient,
    lamports: 1_000,
  });

/** Compute budget, partner swap, tip: a typical legacy swap message. */
function legacySwapMessage(): Uint8Array {
  const tx = new Transaction({ recentBlockhash: BLOCKHASH, feePayer: payer });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
  tx.add(partnerSwap());
  tx.add(tip());
  return Uint8Array.from(tx.serializeMessage());
}

const gatedContext = {
  type: ClearSignContextType.SOLANA_GATED_SIGNING,
  payload: "aabbcc",
  certificate: { payload: new Uint8Array([0x99]), keyUsageNumber: 13 },
} as any;

function makeTask(
  transactionBytes: Uint8Array,
  getContexts: Mock = vi.fn(async () => [gatedContext]),
  deviceReply = CommandResultFactory({ data: undefined }),
  context?: typeof gatedContext,
) {
  const api = {
    sendCommand: vi.fn(async () => deviceReply),
    getDeviceSessionState: vi.fn(() => ({ deviceModelId: DeviceModelId.FLEX })),
  };
  const warn = vi.fn();
  const task = new ProvideGatedSigningTask(api as any, {
    transactionBytes,
    contextModule: { getContexts } as any,
    loggerFactory: () =>
      ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }) as any,
    context,
  });
  return { task, api, getContexts, warn };
}

describe("ProvideGatedSigningTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for the gating descriptor with every top-level instruction but ComputeBudget", async () => {
    const { task, getContexts } = makeTask(legacySwapMessage());

    await task.run();

    expect(getContexts).toHaveBeenCalledWith(
      {
        deviceModelId: DeviceModelId.FLEX,
        gatedSigning: {
          instructions: [
            { programId: PARTNER.toBase58(), data: SWAP_DATA },
            {
              programId: SystemProgram.programId.toBase58(),
              // Transfer (u32 LE 2) of 1000 lamports (u64 LE)
              data: new Uint8Array([2, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0]),
            },
          ],
        },
      },
      [ClearSignContextType.SOLANA_GATED_SIGNING],
    );
  });

  it("reads program IDs of a v0 message that uses a lookup table", async () => {
    const lookedUp = Keypair.generate().publicKey;
    const table = new AddressLookupTableAccount({
      key: Keypair.generate().publicKey,
      state: {
        deactivationSlot: BigInt("18446744073709551615"),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses: [lookedUp],
      },
    });
    const message = MessageV0.compile({
      payerKey: payer,
      recentBlockhash: BLOCKHASH,
      instructions: [partnerSwap([payer, lookedUp])],
      addressLookupTableAccounts: [table],
    });
    expect(message.addressTableLookups).toHaveLength(1);
    const { task, getContexts } = makeTask(message.serialize());

    await task.run();

    expect(getContexts.mock.calls[0]![0].gatedSigning.instructions).toEqual([
      { programId: PARTNER.toBase58(), data: SWAP_DATA },
    ]);
  });

  it("skips an instruction whose program ID points into a lookup table", async () => {
    // The runtime rejects this message; the device must not read the
    // program ID from the table either.
    const message = new MessageV0({
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      staticAccountKeys: [payer, SystemProgram.programId],
      recentBlockhash: BLOCKHASH,
      compiledInstructions: [
        { programIdIndex: 2, accountKeyIndexes: [], data: SWAP_DATA },
        {
          programIdIndex: 1,
          accountKeyIndexes: [0],
          data: new Uint8Array([2, 0, 0, 0]),
        },
      ],
      addressTableLookups: [
        {
          accountKey: Keypair.generate().publicKey,
          writableIndexes: [],
          readonlyIndexes: [0],
        },
      ],
    });
    const { task, getContexts } = makeTask(message.serialize());

    await task.run();

    expect(getContexts.mock.calls[0]![0].gatedSigning.instructions).toEqual([
      {
        programId: SystemProgram.programId.toBase58(),
        data: new Uint8Array([2, 0, 0, 0]),
      },
    ]);
  });

  it("loads the certificate, sends the descriptor and returns it", async () => {
    const { task, api } = makeTask(legacySwapMessage());

    const result = await task.run();

    expect(result).toEqual(Right(gatedContext));
    const sent = api.sendCommand.mock.calls.map(([cmd]: any[]) => cmd);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBeInstanceOf(LoadCertificateCommand);
    expect(sent[1]).toBeInstanceOf(ProvideGatedSigningCommand);
    expect(sent[1].args.payload).toStrictEqual(
      new Uint8Array([0xaa, 0xbb, 0xcc]),
    );
  });

  it("re-sends a given descriptor without a new CAL lookup", async () => {
    const { task, api, getContexts } = makeTask(
      legacySwapMessage(),
      undefined,
      undefined,
      gatedContext,
    );

    const result = await task.run();

    expect(result).toEqual(Right(gatedContext));
    expect(getContexts).not.toHaveBeenCalled();
    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.any(ProvideGatedSigningCommand),
    );
  });

  it("returns Right(null) and sends nothing when no descriptor matches", async () => {
    const { task, api } = makeTask(
      legacySwapMessage(),
      vi.fn(async () => []),
    );

    expect(await task.run()).toEqual(Right(null));
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("returns Left, logs and sends nothing for an error context", async () => {
    const { task, api, warn } = makeTask(
      legacySwapMessage(),
      vi.fn(async () => [
        { type: ClearSignContextType.ERROR, error: new Error("CAL down") },
      ]),
    );

    const result = await task.run();

    expect(result.isLeft()).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("returns Left instead of throwing when the lookup throws", async () => {
    const { task, api } = makeTask(
      legacySwapMessage(),
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );

    const result = await task.run();

    expect(result.isLeft()).toBe(true);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("returns Left without a lookup when the message can't be parsed", async () => {
    const { task, getContexts, warn } = makeTask(new Uint8Array([1, 2, 3]));

    const result = await task.run();

    expect(result.isLeft()).toBe(true);
    expect(getContexts).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("returns Left when the device rejects the descriptor", async () => {
    const rejection = {
      _tag: "E",
      errorCode: 0x6d00,
      message: "unknown INS",
    } as any;
    const { task, warn } = makeTask(
      legacySwapMessage(),
      undefined,
      CommandResultFactory({ error: rejection }),
    );

    const result = await task.run();

    expect(result).toEqual(Left(rejection));
    expect(warn).toHaveBeenCalled();
  });
});
