import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  Message,
  type PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  COIN_DATA,
  GenerateSolanaTransaction,
} from "./GenerateSolanaTransaction";

describe("GenerateSolanaTransaction", () => {
  const feePayer = Keypair.generate();
  const recipient = Keypair.generate();
  const feePayerKey = feePayer.publicKey.toBase58();
  const recipientKey = recipient.publicKey.toBase58();

  it("generateUsdcTransaction should equal generateSplTokenTransaction with USDC constants", () => {
    // given
    const gen = new GenerateSolanaTransaction();
    const txA = gen.generateUsdcTransaction(feePayerKey, recipientKey, 2.5, 3);

    // when
    const txB = gen.generateSplTokenTransaction(
      feePayerKey,
      recipientKey,
      COIN_DATA.USDC.mint.toBase58(),
      2.5,
      COIN_DATA.USDC.decimals,
      3,
    );

    // then
    expect(txA).toBe(txB);
  });

  it("generateSplTokenTransaction emits correct SPL-Token TransferChecked instructions", () => {
    // given
    const gen = new GenerateSolanaTransaction();
    const mint = COIN_DATA.USDC.mint;
    const decimals = COIN_DATA.USDC.decimals;
    const amount = 1.25;
    const transfers = 2;

    // when
    const b64 = gen.generateSplTokenTransaction(
      feePayerKey,
      recipientKey,
      mint.toBase58(),
      amount,
      decimals,
      transfers,
    );

    const uint8Array = Uint8Array.from(Buffer.from(b64, "base64"));
    const msg = Message.from(uint8Array);

    // then
    expect(msg.instructions).toHaveLength(transfers);

    const sourceAta = getAssociatedTokenAddressSync(
      mint,
      feePayer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const destAta = getAssociatedTokenAddressSync(
      mint,
      recipient.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    for (const ix of msg.instructions) {
      // program must be the SPL-Token program
      const pid = msg.accountKeys[ix.programIdIndex]!;
      expect(pid.equals(TOKEN_PROGRAM_ID)).toBe(true);

      // first account is source ATA, second is mint, third is dest ATA
      expect(
        (msg.accountKeys[ix.accounts[0]!] as PublicKey).equals(sourceAta),
      ).toBe(true);
      expect((msg.accountKeys[ix.accounts[1]!] as PublicKey).equals(mint)).toBe(
        true,
      );
      expect(
        (msg.accountKeys[ix.accounts[2]!] as PublicKey).equals(destAta),
      ).toBe(true);

      // feePayer must sign
      expect(
        (msg.accountKeys[ix.accounts[3]!] as PublicKey).equals(
          feePayer.publicKey,
        ),
      ).toBe(true);
    }
  });

  it("generatePlainSolanaTransaction emits correct SystemProgram.transfer instructions", () => {
    // given
    const gen = new GenerateSolanaTransaction();
    const lamports = 1_000;
    const ops = 3;

    // when
    const b64 = gen.generatePlainSolanaTransaction(
      feePayerKey,
      recipientKey,
      lamports,
      ops,
    );
    const uint8Array = Uint8Array.from(Buffer.from(b64, "base64"));
    const msg = Message.from(uint8Array);

    // then
    expect(msg.instructions).toHaveLength(ops);

    for (const ix of msg.instructions) {
      // program must be SystemProgram
      const pid = msg.accountKeys[ix.programIdIndex]!;
      expect(pid.equals(SystemProgram.programId)).toBe(true);

      // accounts: [fromPubkey, toPubkey]
      expect((msg.accountKeys[ix.accounts[0]!] as PublicKey).toBase58()).toBe(
        feePayerKey,
      );
      expect((msg.accountKeys[ix.accounts[1]!] as PublicKey).toBase58()).toBe(
        recipientKey,
      );
    }
  });
});
