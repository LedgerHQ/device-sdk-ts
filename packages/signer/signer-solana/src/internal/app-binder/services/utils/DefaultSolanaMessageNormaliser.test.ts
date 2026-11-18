import {
  type Blockhash,
  type PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";

import { testPublicKey } from "@internal/app-binder/services/__test-utils__/testKeys";

import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "./DefaultSolanaMessageNormaliser";

const DUMMY_BLOCKHASH = bs58.encode(new Uint8Array(32).fill(0xaa)) as Blockhash;

function makeSignedRawTx(
  instructions: Parameters<Transaction["add"]>[0][],
  signers: PublicKey[],
  feePayer?: PublicKey,
) {
  const payer = feePayer ?? signers[0] ?? testPublicKey();
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer;
  tx.add(...instructions);
  // Signed wire format with zero-filled signatures: the normaliser reads the
  // message and never verifies signatures.
  const raw = new VersionedTransaction(tx.compileMessage()).serialize();
  return { raw, payer };
}

describe("DefaultSolanaMessageNormaliser", () => {
  it("normalises a legacy tx with multiple SystemProgram.transfer instructions preserving order", async () => {
    // given
    const payer = testPublicKey();
    const recipients = [testPublicKey(), testPublicKey(), testPublicKey()];
    const lamports = 1234;

    const instructions = recipients.map((r) =>
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: r,
        lamports,
      }),
    );

    const { raw } = makeSignedRawTx(instructions, [payer], payer);

    // when
    const normaliser = new DefaultSolanaMessageNormaliser();
    const msg = await normaliser.normaliseMessage(raw);

    // then
    // same number of compiled instructions
    expect(msg.compiledInstructions).toHaveLength(instructions.length);

    for (let i = 0; i < instructions.length; i++) {
      const compiled = msg.compiledInstructions[i]!;
      const programId = msg.allKeys[compiled.programIdIndex]!;
      // program resolves to SystemProgram
      expect(programId.equals(SystemProgram.programId)).toBe(true);

      // accounts resolve to [from, to] in order
      const accounts = compiled.accountKeyIndexes.map(
        (idx) => msg.allKeys[idx]!,
      );
      expect((accounts[0] as PublicKey).equals(payer)).toBe(true);
      expect((accounts[1] as PublicKey).equals(recipients[i]!)).toBe(true);

      // data is present (SystemProgram.transfer has non-empty data)
      expect(compiled.data instanceof Uint8Array).toBe(true);
      expect(compiled.data.length).toBeGreaterThan(0);
    }
  });

  it("can be used via the SolanaMessageNormaliser interface", async () => {
    // given
    const payer = testPublicKey();
    const recipient = testPublicKey();
    const instruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports: 1_000,
    });
    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    // when (using the instance via the interface type)
    const normaliser: SolanaMessageNormaliser =
      new DefaultSolanaMessageNormaliser();
    const msg = await normaliser.normaliseMessage(raw);

    // then
    expect(msg.compiledInstructions).toHaveLength(1);
    const compiled = msg.compiledInstructions[0]!;
    const programId = msg.allKeys[compiled.programIdIndex]!;
    expect(programId.equals(SystemProgram.programId)).toBe(true);

    const accounts = compiled.accountKeyIndexes.map((i) => msg.allKeys[i]!);
    expect((accounts[0] as PublicKey).equals(payer)).toBe(true);
    expect((accounts[1] as PublicKey).equals(recipient)).toBe(true);
  });

  it("handles single-instruction tx and preserves indices mapping", async () => {
    // given
    const payer = testPublicKey();
    const recipient = testPublicKey();
    const lamports = 5;

    const instruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports,
    });

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    // when
    const normaliser = new DefaultSolanaMessageNormaliser();
    const msg = await normaliser.normaliseMessage(raw);

    // then
    expect(Array.isArray(msg.allKeys)).toBe(true);
    expect(msg.allKeys.length).toBeGreaterThanOrEqual(3);

    const compiled = msg.compiledInstructions[0]!;
    const resolvedPid = msg.allKeys[compiled.programIdIndex]!;
    expect(resolvedPid.equals(SystemProgram.programId)).toBe(true);

    const [fromPk, toPk] = compiled.accountKeyIndexes.map(
      (i) => msg.allKeys[i]!,
    );
    expect((fromPk as PublicKey).equals(payer)).toBe(true);
    expect((toPk as PublicKey).equals(recipient)).toBe(true);
  });
});
