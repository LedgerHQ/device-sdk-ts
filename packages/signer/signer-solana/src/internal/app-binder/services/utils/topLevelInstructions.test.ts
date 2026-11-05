import {
  ComputeBudgetProgram,
  Keypair,
  MessageV0,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { COMPUTE_BUDGET_PROGRAM_ID } from "@internal/app-binder/constants";

import { topLevelInstructions } from "./topLevelInstructions";
import { TransactionParser } from "./TransactionParser";

const BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";
const payer = new PublicKey("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const recipient = new PublicKey("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");

const parse = async (bytes: Uint8Array) =>
  (await new TransactionParser().parse(bytes).run()).unsafeCoerce().message;

describe("topLevelInstructions", () => {
  it("returns program ID and plain data per instruction, without ComputeBudget", async () => {
    const tx = new Transaction({ recentBlockhash: BLOCKHASH, feePayer: payer });
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: recipient,
        lamports: 1_000,
      }),
    );

    const instructions = topLevelInstructions(
      await parse(Uint8Array.from(tx.serializeMessage())),
    );

    expect(instructions).toEqual([
      {
        programId: SystemProgram.programId.toBase58(),
        data: new Uint8Array([2, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0]),
      },
    ]);
    // Plain bytes, not the Buffer a legacy message holds.
    expect(Buffer.isBuffer(instructions[0]!.data)).toBe(false);
    expect(instructions.map(({ programId }) => programId)).not.toContain(
      COMPUTE_BUDGET_PROGRAM_ID,
    );
  });

  it("leaves out a lookup-table program ID kept as a placeholder (preserveAltRefs)", async () => {
    const message = new MessageV0({
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 0,
      },
      staticAccountKeys: [payer],
      recentBlockhash: BLOCKHASH,
      compiledInstructions: [
        { programIdIndex: 1, accountKeyIndexes: [], data: new Uint8Array([1]) },
      ],
      addressTableLookups: [
        {
          accountKey: Keypair.generate().publicKey,
          writableIndexes: [],
          readonlyIndexes: [0],
        },
      ],
    });
    const parsed = (
      await new TransactionParser(undefined, { preserveAltRefs: true })
        .parse(message.serialize())
        .run()
    ).unsafeCoerce().message;

    // The placeholder key at the ALT slot is all zeros, the System Program.
    expect(parsed.allKeys[1]!.toBase58()).toBe(
      SystemProgram.programId.toBase58(),
    );
    expect(topLevelInstructions(parsed)).toEqual([]);
  });

  it("leaves out an instruction whose program ID points into a lookup table", async () => {
    const message = new MessageV0({
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      staticAccountKeys: [payer, SystemProgram.programId],
      recentBlockhash: BLOCKHASH,
      compiledInstructions: [
        { programIdIndex: 2, accountKeyIndexes: [], data: new Uint8Array([1]) },
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

    expect(topLevelInstructions(await parse(message.serialize()))).toEqual([
      {
        programId: SystemProgram.programId.toBase58(),
        data: new Uint8Array([2, 0, 0, 0]),
      },
    ]);
  });
});
