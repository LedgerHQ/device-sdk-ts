import {
  Keypair,
  type PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";

import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliserConstructor,
} from "./DefaultSolanaMessageNormaliser";

const DUMMY_BLOCKHASH = bs58.encode(new Uint8Array(32).fill(0xaa));

function makeSignedRawTx(
  instructions: Parameters<Transaction["add"]>[0][],
  signers: Keypair[],
  feePayer?: Keypair,
) {
  const payer = feePayer ?? signers[0] ?? Keypair.generate();
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer.publicKey;
  tx.add(...instructions);

  // unique signers: fee payer first
  const seen = new Set<string>();
  const uniq = [payer, ...signers].filter((kp) => {
    const k = kp.publicKey.toBase58();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  tx.sign(...uniq);
  return { raw: tx.serialize(), payer };
}

describe("DefaultSolanaMessageNormaliser", () => {
  it("normalises a legacy tx with multiple SystemProgram.transfer instructions preserving order", async () => {
    // given
    const payer = Keypair.generate();
    const recipients = [
      Keypair.generate(),
      Keypair.generate(),
      Keypair.generate(),
    ];
    const lamports = 1234;

    const instructions = recipients.map((r) =>
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: r.publicKey,
        lamports,
      }),
    );

    const { raw } = makeSignedRawTx(instructions, [payer], payer);

    // when
    const msg = await DefaultSolanaMessageNormaliser.normaliseMessage(raw);

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
      expect((accounts[0] as PublicKey).equals(payer.publicKey)).toBe(true);
      expect((accounts[1] as PublicKey).equals(recipients[i]!.publicKey)).toBe(
        true,
      );

      // data is present (SystemProgram.transfer has non-empty data)
      expect(compiled.data instanceof Uint8Array).toBe(true);
      expect(compiled.data.length).toBeGreaterThan(0);
    }
  });

  it("can be used via the SolanaMessageNormaliserConstructor interface", async () => {
    // given
    const payer = Keypair.generate();
    const recipient = Keypair.generate();
    const instruction = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1_000,
    });
    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    // when (note: using the class as a static 'constructor-like' value)
    const Normaliser: SolanaMessageNormaliserConstructor =
      DefaultSolanaMessageNormaliser;
    const msg = await Normaliser.normaliseMessage(raw);

    // then
    expect(msg.compiledInstructions).toHaveLength(1);
    const compiled = msg.compiledInstructions[0]!;
    const programId = msg.allKeys[compiled.programIdIndex]!;
    expect(programId.equals(SystemProgram.programId)).toBe(true);

    const accounts = compiled.accountKeyIndexes.map((i) => msg.allKeys[i]!);
    expect((accounts[0] as PublicKey).equals(payer.publicKey)).toBe(true);
    expect((accounts[1] as PublicKey).equals(recipient.publicKey)).toBe(true);
  });

  it("handles single-instruction tx and preserves indices mapping", async () => {
    // given
    const payer = Keypair.generate();
    const recipient = Keypair.generate();
    const lamports = 5;

    const instruction = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports,
    });

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    // when
    const msg = await DefaultSolanaMessageNormaliser.normaliseMessage(raw);

    // then
    expect(Array.isArray(msg.allKeys)).toBe(true);
    expect(msg.allKeys.length).toBeGreaterThanOrEqual(3);

    const compiled = msg.compiledInstructions[0]!;
    const resolvedPid = msg.allKeys[compiled.programIdIndex]!;
    expect(resolvedPid.equals(SystemProgram.programId)).toBe(true);

    const [fromPk, toPk] = compiled.accountKeyIndexes.map(
      (i) => msg.allKeys[i]!,
    );
    expect((fromPk as PublicKey).equals(payer.publicKey)).toBe(true);
    expect((toPk as PublicKey).equals(recipient.publicKey)).toBe(true);
  });
});
