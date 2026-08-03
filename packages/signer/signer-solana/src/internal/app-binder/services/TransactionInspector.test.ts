import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@internal/app-binder/services/utils/splToken";

import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeAccount2Instruction,
  createInitializeAccount3Instruction,
  createInitializeAccountInstruction,
  createSyncNativeInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
} from "./__test-utils__/splTokenBuilders";
import {
  extractMintAddress,
  type NormalizedMessage,
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

  it("detects an SPL TransferChecked and returns the destination address and mint", async () => {
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
    expect(result.data.mintAddress).toBe(mint.toBase58());
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

  it("falls back to STANDARD if the payload is unparseable", async () => {
    const garbage = new Uint8Array([0xab, 0xad, 0xbe, 0xef]);

    const result = await new TransactionInspector().inspectTransactionType(
      garbage,
    );

    expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
    expect(result.data).toEqual({});
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

  it("classifies as SWAP when templateId is provided", async () => {
    const payer = Keypair.generate();
    const dest = Keypair.generate().publicKey;

    const instruction = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: dest,
      lamports: 1_000,
    });

    const { raw } = makeSignedRawTx([instruction], [payer], payer);

    const result = await new TransactionInspector().inspectTransactionType(
      raw,
      undefined,
      undefined,
      "some-template-id",
    );

    expect(result.transactionType).toBe(SolanaTransactionTypes.SWAP);
    expect(result.data).toEqual({});
  });

  it("SWAP takes precedence over SPL when templateId is provided", async () => {
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

    const result = await new TransactionInspector().inspectTransactionType(
      raw,
      undefined,
      undefined,
      "swap-template-id",
    );

    expect(result.transactionType).toBe(SolanaTransactionTypes.SWAP);
    expect(result.data).toEqual({});
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
});

describe("extractMintAddress", () => {
  const TRANSFER_CHECKED_DISC = 12; // SPL TokenInstruction.TransferChecked
  const TRANSFER_DISC = 3; // SPL TokenInstruction.Transfer (no mint in accounts)

  it("extracts mint from a TransferChecked instruction in static keys", () => {
    const tokenProgram = TOKEN_PROGRAM_ID;
    const source = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    // allKeys layout: [tokenProgram, source, mint, destination, owner]
    // TransferChecked accounts: [source=1, mint=2, destination=3, owner=4]
    const message: NormalizedMessage = {
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 2, 3, 4],
          accountWritable: [true, true, true, false],
          data: new Uint8Array([TRANSFER_CHECKED_DISC]),
        },
      ],
      allKeys: [tokenProgram, source, mint, destination, owner],
    };

    expect(extractMintAddress(message, false)).toBe(mint.toBase58());
  });

  it("returns undefined for a plain Transfer instruction (no mint slot)", () => {
    const tokenProgram = TOKEN_PROGRAM_ID;
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    // Transfer accounts: [source=1, destination=2, owner=3] — no mint
    const message: NormalizedMessage = {
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 2, 3],
          accountWritable: [true, true, false],
          data: new Uint8Array([TRANSFER_DISC]),
        },
      ],
      allKeys: [tokenProgram, source, destination, owner],
    };

    expect(extractMintAddress(message, false)).toBeUndefined();
  });

  it("bails out when mint account index is out of static-keys range and tx uses ALTs", () => {
    const tokenProgram = TOKEN_PROGRAM_ID;
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    // Mint global index 99 is outside allKeys (4 entries) → undefined at runtime
    const message: NormalizedMessage = {
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 99, 2, 3], // local slot 1 → global idx 99 (ALT)
          accountWritable: [true, true, true, false],
          data: new Uint8Array([TRANSFER_CHECKED_DISC]),
        },
      ],
      allKeys: [tokenProgram, source, destination, owner],
    };

    expect(extractMintAddress(message, true)).toBeUndefined();
  });

  it("returns mint when it is in static keys even if the tx also uses ALTs", () => {
    const tokenProgram = TOKEN_PROGRAM_ID;
    const source = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    // Mint is in static keys (index 2) — ALTs are used for other accounts
    const message: NormalizedMessage = {
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 2, 3, 4],
          accountWritable: [true, true, true, false],
          data: new Uint8Array([TRANSFER_CHECKED_DISC]),
        },
      ],
      allKeys: [tokenProgram, source, mint, destination, owner],
    };

    expect(extractMintAddress(message, true)).toBe(mint.toBase58());
  });

  it("skips non-SPL instructions and returns undefined when no SPL instruction carries a mint", () => {
    const systemProgram = Keypair.generate().publicKey; // non-SPL
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;

    const message: NormalizedMessage = {
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 2],
          accountWritable: [true, true],
          data: new Uint8Array([2, 0, 0, 0, 232, 3, 0, 0]), // SystemProgram transfer
        },
      ],
      allKeys: [systemProgram, from, to],
    };

    expect(extractMintAddress(message, false)).toBeUndefined();
  });
});
