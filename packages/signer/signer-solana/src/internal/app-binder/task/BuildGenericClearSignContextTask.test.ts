/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { COMPUTE_BUDGET_PROGRAM_ID } from "@internal/app-binder/constants";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { BuildGenericClearSignContextTask } from "./BuildGenericClearSignContextTask";

const DUMMY_BLOCKHASH = DefaultBs58Encoder.encode(
  new Uint8Array(32).fill(0xaa),
);
const KNOWN_PROGRAM = new PublicKey(
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
);
const UNKNOWN_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// Dummy signed TLV hex (streamed to the device; not parsed host-side).
const INFO_HEX = "0001";

// Minimal-but-valid decoded type pool so buildRequirements returns Right.
const MIN_IDL_DESCRIPTOR = {
  typePool: [{ index: 0, kind: "STRUCT", refs: [] }],
  rootType: 0,
};

function makeIx(programId: PublicKey, data: number[]): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      {
        pubkey: Keypair.generate().publicKey,
        isSigner: false,
        isWritable: true,
      },
    ],
    programId,
    data: Buffer.from(data),
  });
}

function makeRawTx(ixs: TransactionInstruction[]): Uint8Array {
  const payer = Keypair.generate();
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer.publicKey;
  tx.add(...ixs);
  tx.sign(payer);
  return tx.serialize();
}

function instructionInfoContext(
  programId: string,
  discriminator: string,
  infoHex: string = INFO_HEX,
): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_INSTRUCTION_INFO,
    payload: {
      programId,
      discriminator,
      instructionInfo: { data: infoHex, signature: "00" },
      substructures: [],
      enumVariants: [],
      idlDescriptor: MIN_IDL_DESCRIPTOR,
      mintAssociations: [],
      ownerAssociations: [],
      valueFlowPorts: [],
      accountResets: [],
      displayFields: [],
      hideRules: [],
    },
  } as any;
}

function makeTask(transaction: Uint8Array, infoContexts: ClearSignContext[]) {
  const getContexts = vi.fn(async (_input: unknown, types: unknown) =>
    (types as ClearSignContextType[]).includes(
      ClearSignContextType.SOLANA_INSTRUCTION_INFO,
    )
      ? infoContexts
      : [],
  );
  const contextModule = { getContexts } as unknown as ContextModule;
  const task = new BuildGenericClearSignContextTask({
    contextModule,
    transaction,
    deviceModelId: DeviceModelId.STAX,
    loggerFactory: () =>
      ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }) as any,
    // Stub the enum decoder (the minimal fixture pool isn't real-decodable).
    selectEnumVariants: () => Right([]),
  });
  return { task, getContexts };
}

describe("BuildGenericClearSignContextTask", () => {
  it("returns mode `full` and a template when every non-ComputeBudget instruction is recognized", async () => {
    const tx = makeRawTx([
      makeIx(new PublicKey(COMPUTE_BUDGET_PROGRAM_ID), [0x02, 0x40, 0x42]),
      makeIx(KNOWN_PROGRAM, [0x01, 0x02, 0xaa]),
    ]);
    const { task, getContexts } = makeTask(tx, [
      instructionInfoContext(KNOWN_PROGRAM.toBase58(), "0102"),
    ]);

    const result = await task.run();

    expect(result.mode).toBe("full");
    expect(result.instructionInfoContexts).toHaveLength(1);
    expect(result.unrecognizedProgramIds).toEqual([]);
    // ComputeBudget is never looked up in CAL.
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: [{ programId: KNOWN_PROGRAM.toBase58() }],
      }),
      [ClearSignContextType.SOLANA_INSTRUCTION_INFO],
    );
  });

  it("matches a descriptor without a discriminator against any instruction data", async () => {
    // Single-instruction programs (e.g. SPL Memo `addMemo`) have no
    // discriminator: CAL omits `discriminator_hex` and the whole instruction
    // data is arguments.
    const tx = makeRawTx([makeIx(KNOWN_PROGRAM, [0x68, 0x69])]);
    const { task } = makeTask(tx, [
      instructionInfoContext(KNOWN_PROGRAM.toBase58(), ""),
    ]);

    const result = await task.run();

    expect(result.mode).toBe("full");
    expect(result.instructionInfoContexts).toHaveLength(1);
    expect(result.unrecognizedProgramIds).toEqual([]);
  });

  it("prefers the most specific descriptor over a discriminator-less one", async () => {
    const tx = makeRawTx([makeIx(KNOWN_PROGRAM, [0x01, 0x02, 0xaa])]);
    const { task } = makeTask(tx, [
      instructionInfoContext(KNOWN_PROGRAM.toBase58(), "", "aaaa"),
      instructionInfoContext(KNOWN_PROGRAM.toBase58(), "0102", "bbbb"),
    ]);

    const result = await task.run();

    expect(result.mode).toBe("full");
    expect(result.instructionInfoContexts).toEqual([
      instructionInfoContext(KNOWN_PROGRAM.toBase58(), "0102", "bbbb"),
    ]);
    expect(result.unrecognizedProgramIds).toEqual([]);
  });

  it("returns mode `none` when some instructions are unrecognized", async () => {
    // Any unrecognized instruction causes FINALIZE to fail on the device
    // (cs_transaction_finalize walks all instructions), so we bail to legacy
    // basic sign from a clean state rather than attempting generic clear-signing.
    const tx = makeRawTx([
      makeIx(KNOWN_PROGRAM, [0x01, 0x02]),
      makeIx(UNKNOWN_PROGRAM, [0x09]),
    ]);
    const { task } = makeTask(tx, [
      instructionInfoContext(KNOWN_PROGRAM.toBase58(), "0102"),
    ]);

    const result = await task.run();

    expect(result.mode).toBe("none");
    expect(result.instructionInfoContexts).toHaveLength(0);
    expect(result.unrecognizedProgramIds).toEqual([UNKNOWN_PROGRAM.toBase58()]);
  });

  it("returns mode `none` when nothing is recognized", async () => {
    const tx = makeRawTx([makeIx(UNKNOWN_PROGRAM, [0x09])]);
    const { task } = makeTask(tx, []);

    const result = await task.run();
    expect(result.mode).toBe("none");
    expect(result.unrecognizedProgramIds).toEqual([UNKNOWN_PROGRAM.toBase58()]);
  });

  it("returns mode `none` for a ComputeBudget-only tx without calling CAL", async () => {
    const tx = makeRawTx([
      makeIx(new PublicKey(COMPUTE_BUDGET_PROGRAM_ID), [0x02, 0x40, 0x42]),
    ]);
    const { task, getContexts } = makeTask(tx, []);

    const result = await task.run();
    expect(result.mode).toBe("none");
    expect(result.unrecognizedProgramIds).toEqual([]);
    expect(getContexts).not.toHaveBeenCalled();
  });
});
