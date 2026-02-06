import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";

import { TransactionClassifier } from "./TransactionClassifier";
import { TransactionParser } from "./TransactionParser";

const DUMMY_BLOCKHASH = DefaultBs58Encoder.encode(
  new Uint8Array(32).fill(0xaa),
);

function makeSignedRawTx(ixs: TransactionInstruction[], payer: Keypair) {
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer.publicKey;
  tx.add(...ixs);
  tx.sign(payer);
  return tx.serialize();
}

async function parseMessage(raw: Uint8Array) {
  const parser = new TransactionParser();
  const { message } = await parser.parse(raw);
  return message;
}

describe("TransactionClassifier", () => {
  const classifier = new TransactionClassifier();

  it("classifies a plain SystemProgram transfer as STANDARD", async () => {
    const payer = Keypair.generate();
    const raw = makeSignedRawTx(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1_000,
        }),
      ],
      payer,
    );

    const message = await parseMessage(raw);
    const result = classifier.classify(message);

    expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
    expect(result.data).toEqual({});
  });

  it("classifies an SPL Transfer as SPL with token address", async () => {
    const owner = Keypair.generate();
    const destination = Keypair.generate().publicKey;

    const raw = makeSignedRawTx(
      [
        createTransferInstruction(
          Keypair.generate().publicKey,
          destination,
          owner.publicKey,
          42n,
          [],
          TOKEN_PROGRAM_ID,
        ),
      ],
      owner,
    );

    const message = await parseMessage(raw);
    const result = classifier.classify(message);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(destination.toBase58());
  });

  it("detects ATA creation", async () => {
    const payer = Keypair.generate();
    const owner = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const raw = makeSignedRawTx(
      [
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          ata,
          owner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      ],
      payer,
    );

    const message = await parseMessage(raw);
    const result = classifier.classify(message);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual({
      address: owner.toBase58(),
      mintAddress: mint.toBase58(),
    });
  });

  describe("fast path (overrides)", () => {
    it("uses tokenAddress override when provided", async () => {
      const owner = Keypair.generate();
      const raw = makeSignedRawTx(
        [
          createTransferInstruction(
            Keypair.generate().publicKey,
            Keypair.generate().publicKey,
            owner.publicKey,
            1n,
            [],
            TOKEN_PROGRAM_ID,
          ),
        ],
        owner,
      );

      const overrideToken = Keypair.generate().publicKey.toBase58();
      const message = await parseMessage(raw);
      const result = classifier.classify(message, overrideToken);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data.tokenAddress).toBe(overrideToken);
    });

    it("uses createATA override when provided", async () => {
      const payer = Keypair.generate();
      const raw = makeSignedRawTx(
        [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: Keypair.generate().publicKey,
            lamports: 1_000,
          }),
        ],
        payer,
      );

      const ataOverride = {
        address: Keypair.generate().publicKey.toBase58(),
        mintAddress: Keypair.generate().publicKey.toBase58(),
      };

      const message = await parseMessage(raw);
      const result = classifier.classify(message, undefined, ataOverride);

      // Non-SPL transaction with override → STANDARD (because no SPL program id)
      expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
      expect(result.data.createATA).toEqual(ataOverride);
    });
  });
});
