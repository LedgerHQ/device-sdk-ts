import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeAccount2Instruction,
  createInitializeAccount3Instruction,
  createInitializeAccountInstruction,
  createSyncNativeInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import {
  SolanaTransactionTypes,
  TransactionInspector,
} from "./TransactionInspector";

const DUMMY_BLOCKHASH = DefaultBs58Encoder.encode(
  new Uint8Array(32).fill(0xaa),
);

function makeSignedRawTx(
  ixs: TransactionInstruction[],
  signers: Keypair[],
  feePayer?: Keypair,
) {
  const payer = feePayer ?? signers[0] ?? Keypair.generate();
  const tx = new Transaction();
  tx.recentBlockhash = DUMMY_BLOCKHASH;
  tx.feePayer = payer.publicKey;
  tx.add(...ixs);
  const seen = new Set<string>();
  const uniqueSigners = [payer, ...signers].filter((kp) => {
    const k = kp.publicKey.toBase58();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  tx.sign(...uniqueSigners);
  return { raw: tx.serialize(), payer };
}

describe("TransactionInspector", () => {
  it("falls back to STANDARD for a plain SystemProgram transfer", async () => {
    const payer = Keypair.generate();
    const dest = Keypair.generate().publicKey;

    const instruction = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: dest,
      lamports: 1_000,
    });

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
    expect(result.data).toEqual({});
    expect(result.instructionCount).toBe(1);
    expect(result.usesAddressLookupTables).toBe(false);
    expect(result.programIds).toContain(
      SystemProgram.programId.toBase58(),
    );
  });

  it("detects an SPL Transfer and returns the destination address", async () => {
    const owner = Keypair.generate();
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;

    const instruction = createTransferInstruction(
      source,
      destination,
      owner.publicKey,
      42n,
      [],
      TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [owner], owner);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(destination.toBase58());
  });

  it("detects an SPL TransferChecked and returns the destination address", async () => {
    const owner = Keypair.generate();
    const mint = Keypair.generate().publicKey;
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;

    const instruction = createTransferCheckedInstruction(
      source,
      mint,
      destination,
      owner.publicKey,
      123n,
      0,
      [],
      TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [owner], owner);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(destination.toBase58());
  });

  it("detects InitializeAccount and returns the new account and mint", async () => {
    const payer = Keypair.generate();
    const mint = Keypair.generate().publicKey;
    const newAccount = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    const instruction = createInitializeAccountInstruction(
      newAccount,
      mint,
      owner,
      TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual({
      address: newAccount.toBase58(),
      mintAddress: mint.toBase58(),
    });
  });

  it("detects InitializeAccount2 and returns the new account and mint", async () => {
    const payer = Keypair.generate();
    const mint = Keypair.generate().publicKey;
    const newAccount = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    const instruction = createInitializeAccount2Instruction(
      newAccount,
      mint,
      owner,
      TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual({
      address: newAccount.toBase58(),
      mintAddress: mint.toBase58(),
    });
  });

  it("detects InitializeAccount3 and returns the new account and mint", async () => {
    const payer = Keypair.generate();
    const mint = Keypair.generate().publicKey;
    const newAccount = Keypair.generate().publicKey;

    const instruction = createInitializeAccount3Instruction(
      newAccount,
      mint,
      TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual({
      address: newAccount.toBase58(),
      mintAddress: mint.toBase58(),
    });
  });

  it("detects ATA creation via Associated Token Program (classic TOKEN program)", async () => {
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

    const instruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual({
      address: owner.toBase58(),
      mintAddress: mint.toBase58(),
    });
  });

  it("detects ATA creation via Associated Token Program (TOKEN-2022 program)", async () => {
    const payer = Keypair.generate();
    const owner = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const ata22 = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const instruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata22,
      owner,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual({
      address: owner.toBase58(),
      mintAddress: mint.toBase58(),
    });
  });

  it("detects CloseAccount and returns the closed token account", async () => {
    const owner = Keypair.generate();
    const account = Keypair.generate().publicKey;
    const dest = Keypair.generate().publicKey;

    const instruction = createCloseAccountInstruction(
      account,
      dest,
      owner.publicKey,
    );

    const { raw } = makeSignedRawTx([instruction], [owner], owner);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(account.toBase58());
  });

  it("detects SyncNative and returns the WSOL account", async () => {
    const payer = Keypair.generate();
    const account = Keypair.generate().publicKey;

    const instruction = createSyncNativeInstruction(account, TOKEN_PROGRAM_ID);

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(account.toBase58());
  });

  it("marks transaction as SPL even if decoders can't parse (last-resort SPL by program id)", async () => {
    const payer = Keypair.generate();
    const bogusIx = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [],
      data: Buffer.from([]),
    });

    const { raw } = makeSignedRawTx([bogusIx], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data).toEqual({});
  });

  it("throws if the payload is unparseable", async () => {
    const garbage = new Uint8Array([0xab, 0xad, 0xbe, 0xef]);

    await expect(
      new TransactionInspector().inspectTransactionType(garbage),
    ).rejects.toThrow();
  });

  it("fast path: tokenAddress override + SPL instruction, SPL and returns override", async () => {
    const owner = Keypair.generate();
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;

    const instruction = createTransferInstruction(
      source,
      destination,
      owner.publicKey,
      1n,
      [],
      TOKEN_PROGRAM_ID,
    );
    const { raw } = makeSignedRawTx([instruction], [owner], owner);

    const overrideToken = Keypair.generate().publicKey.toBase58();

    const result = await new TransactionInspector().inspectTransactionType(
      raw,
      overrideToken, // tokenAddress override
    );

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(overrideToken);
  });

  it("fast path: createATA override + ATA instruction, SPL and returns override", async () => {
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

    const instruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const overrideATA = {
      address: Keypair.generate().publicKey.toBase58(),
      mintAddress: Keypair.generate().publicKey.toBase58(),
    };

    const result = await new TransactionInspector().inspectTransactionType(
      raw,
      undefined, // no tokenAddress override
      overrideATA, // createATA override
    );

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.createATA).toEqual(overrideATA);
  });

  it("fast path: both overrides + SPL instruction, SPL and returns both", async () => {
    const owner = Keypair.generate();
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;

    const instruction = createTransferInstruction(
      source,
      destination,
      owner.publicKey,
      7n,
      [],
      TOKEN_PROGRAM_ID,
    );
    const { raw } = makeSignedRawTx([instruction], [owner], owner);

    const tokenOverride = Keypair.generate().publicKey.toBase58();
    const ataOverride = {
      address: Keypair.generate().publicKey.toBase58(),
      mintAddress: Keypair.generate().publicKey.toBase58(),
    };

    const result = await new TransactionInspector().inspectTransactionType(
      raw,
      tokenOverride,
      ataOverride,
    );

    expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
    expect(result.data.tokenAddress).toBe(tokenOverride);
    expect(result.data.createATA).toEqual(ataOverride);
  });

  it("returns correct instructionCount for multi-instruction transactions", async () => {
    const payer = Keypair.generate();
    const dest1 = Keypair.generate().publicKey;
    const dest2 = Keypair.generate().publicKey;
    const dest3 = Keypair.generate().publicKey;

    const { raw } = makeSignedRawTx(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: dest1,
          lamports: 1_000,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: dest2,
          lamports: 2_000,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: dest3,
          lamports: 3_000,
        }),
      ],
      [payer],
      payer,
    );

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.instructionCount).toBe(3);
    expect(result.programIds).toContain(SystemProgram.programId.toBase58());
    expect(result.usesAddressLookupTables).toBe(false);
  });

  it("returns programIds for mixed program transactions", async () => {
    const payer = Keypair.generate();
    const dest = Keypair.generate().publicKey;
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;

    const solTransfer = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: dest,
      lamports: 1_000,
    });

    const tokenTransfer = createTransferInstruction(
      source,
      destination,
      payer.publicKey,
      42n,
      [],
      TOKEN_PROGRAM_ID,
    );

    const { raw } = makeSignedRawTx(
      [solTransfer, tokenTransfer],
      [payer],
      payer,
    );

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.programIds).toContain(SystemProgram.programId.toBase58());
    expect(result.programIds).toContain(TOKEN_PROGRAM_ID.toBase58());
    expect(result.instructionCount).toBe(2);
  });

  it("detects unrecognized programs in programIds", async () => {
    const payer = Keypair.generate();
    const unknownProgram = Keypair.generate().publicKey;

    const bogusIx = new TransactionInstruction({
      programId: unknownProgram,
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from([0x01]),
    });

    const { raw } = makeSignedRawTx([bogusIx], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(raw);

    expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
    expect(result.programIds).toContain(unknownProgram.toBase58());
    expect(result.instructionCount).toBe(1);
  });

  it("throws when the payload is unparseable (state machine handles as inspection_failed)", async () => {
    const garbage = new Uint8Array([0xab, 0xad, 0xbe, 0xef]);

    await expect(
      new TransactionInspector().inspectTransactionType(garbage),
    ).rejects.toThrow();
  });

  describe("hasAddressLookupTables", () => {
    it("returns false for a legacy transaction", () => {
      const payer = Keypair.generate();
      const dest = Keypair.generate().publicKey;

      const { raw } = makeSignedRawTx(
        [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: dest,
            lamports: 1_000,
          }),
        ],
        [payer],
        payer,
      );

      expect(TransactionInspector.hasAddressLookupTables(raw)).toBe(false);
    });

    it("returns false for garbage bytes", () => {
      const garbage = new Uint8Array([0xab, 0xad, 0xbe, 0xef]);
      expect(TransactionInspector.hasAddressLookupTables(garbage)).toBe(false);
    });
  });
});
