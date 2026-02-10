import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, type PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  classify,
  extractSPLData,
  extractValidatedATA,
  type NormalizedMessage,
  SolanaTransactionTypes,
} from "./TransactionInspector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a fresh random PublicKey. */
const pk = () => Keypair.generate().publicKey;

/**
 * Build a minimal NormalizedMessage from a list of instruction descriptors.
 *
 * Each descriptor provides:
 *   - `programId` – the program that owns the instruction
 *   - `accounts`  – the account PublicKeys referenced by the instruction
 *   - `data`      – the raw instruction data bytes
 *
 * All keys (programIds + accounts) are collected into `allKeys` and the
 * instructions reference them by index, exactly like the real normaliser.
 */
function buildMessage(
  instructions: {
    programId: PublicKey;
    accounts: PublicKey[];
    data: Uint8Array;
  }[],
): NormalizedMessage {
  const keyIndex = new Map<string, number>();
  const allKeys: PublicKey[] = [];

  const intern = (key: PublicKey): number => {
    const b58 = key.toBase58();
    if (keyIndex.has(b58)) return keyIndex.get(b58)!;
    const idx = allKeys.length;
    allKeys.push(key);
    keyIndex.set(b58, idx);
    return idx;
  };

  const compiledInstructions = instructions.map((ix) => ({
    programIdIndex: intern(ix.programId),
    accountKeyIndexes: ix.accounts.map(intern),
    data: ix.data,
  }));

  return { compiledInstructions, allKeys };
}

/** Shorthand: build a message with a single instruction. */
const singleIx = (
  programId: PublicKey,
  accounts: PublicKey[],
  data: Uint8Array,
) => buildMessage([{ programId, accounts, data }]);

// ---------------------------------------------------------------------------
// classify()
// ---------------------------------------------------------------------------

describe("classify", () => {
  // ----- fast path (caller-supplied overrides) -----

  describe("fast path", () => {
    it("returns SPL + tokenAddress when tokenAddress is provided and instruction is SPL", () => {
      const addr = pk().toBase58();
      const msg = singleIx(TOKEN_PROGRAM_ID, [pk()], new Uint8Array([3]));

      const result = classify(msg, addr);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data).toEqual({ tokenAddress: addr });
    });

    it("returns STANDARD + tokenAddress when tokenAddress is provided but instruction is non-SPL", () => {
      const addr = pk().toBase58();
      const msg = singleIx(
        SystemProgram.programId,
        [pk()],
        new Uint8Array([2, 0, 0, 0]),
      );

      const result = classify(msg, addr);

      expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
      expect(result.data).toEqual({ tokenAddress: addr });
    });

    it("returns SPL + createATA when createATA is provided and instruction is SPL", () => {
      const ata = { address: pk().toBase58(), mintAddress: pk().toBase58() };
      const msg = singleIx(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        [pk()],
        new Uint8Array([]),
      );

      const result = classify(msg, undefined, ata);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data).toEqual({ createATA: ata });
    });

    it("returns both tokenAddress and createATA when both provided", () => {
      const addr = pk().toBase58();
      const ata = { address: pk().toBase58(), mintAddress: pk().toBase58() };
      const msg = singleIx(TOKEN_PROGRAM_ID, [pk()], new Uint8Array([3]));

      const result = classify(msg, addr, ata);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data.tokenAddress).toBe(addr);
      expect(result.data.createATA).toEqual(ata);
    });
  });

  // ----- full scan -----

  describe("full scan", () => {
    it("returns STANDARD with empty data for non-SPL instruction", () => {
      const msg = singleIx(
        SystemProgram.programId,
        [pk(), pk()],
        new Uint8Array([2, 0, 0, 0]),
      );

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
      expect(result.data).toEqual({});
    });

    it("returns SPL with tokenAddress for a Transfer instruction", () => {
      const source = pk();
      const destination = pk();
      const owner = pk();
      const msg = singleIx(
        TOKEN_PROGRAM_ID,
        [source, destination, owner],
        new Uint8Array([3]),
      );

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data.tokenAddress).toBe(destination.toBase58());
    });

    it("returns SPL with createATA for an InitializeAccount instruction", () => {
      const account = pk();
      const mint = pk();
      const msg = singleIx(
        TOKEN_PROGRAM_ID,
        [account, mint, pk()],
        new Uint8Array([1]),
      );

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data.createATA).toEqual({
        address: account.toBase58(),
        mintAddress: mint.toBase58(),
      });
    });

    it("accumulates createATA even when tokenAddress was already found", () => {
      const destination = pk();
      const account = pk();
      const mint = pk();

      const msg = buildMessage([
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [pk(), destination, pk()],
          data: new Uint8Array([3]), // Transfer
        },
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [account, mint, pk()],
          data: new Uint8Array([1]), // InitializeAccount
        },
      ]);

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      // createATA is accumulated alongside the earlier tokenAddress
      expect(result.data.createATA).toEqual({
        address: account.toBase58(),
        mintAddress: mint.toBase58(),
      });
      // tokenAddress was set first and preserved via spread
      expect(result.data.tokenAddress).toBe(destination.toBase58());
    });

    it("does not set tokenAddress once createATA exists", () => {
      const account = pk();
      const mint = pk();
      const destination = pk();

      const msg = buildMessage([
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [account, mint, pk()],
          data: new Uint8Array([1]), // InitializeAccount → createATA
        },
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [pk(), destination, pk()],
          data: new Uint8Array([3]), // Transfer → would be tokenAddress
        },
      ]);

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data.createATA).toEqual({
        address: account.toBase58(),
        mintAddress: mint.toBase58(),
      });
      // tokenAddress is NOT set because createATA was already found
      expect(result.data.tokenAddress).toBeUndefined();
    });

    it("first createATA match wins when multiple appear", () => {
      const account1 = pk();
      const mint1 = pk();
      const account2 = pk();
      const mint2 = pk();

      const msg = buildMessage([
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [account1, mint1, pk()],
          data: new Uint8Array([1]), // InitializeAccount
        },
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [account2, mint2, pk()],
          data: new Uint8Array([16]), // InitializeAccount2
        },
      ]);

      const result = classify(msg);

      expect(result.data.createATA).toEqual({
        address: account1.toBase58(),
        mintAddress: mint1.toBase58(),
      });
    });

    it("first tokenAddress match wins when multiple transfers appear", () => {
      const dest1 = pk();
      const dest2 = pk();

      const msg = buildMessage([
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [pk(), dest1, pk()],
          data: new Uint8Array([3]), // Transfer
        },
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [pk(), dest2, pk()],
          data: new Uint8Array([3]), // Transfer
        },
      ]);

      const result = classify(msg);

      expect(result.data.tokenAddress).toBe(dest1.toBase58());
    });

    it("returns SPL with empty data when SPL program is seen but data is not decodable", () => {
      const msg = singleIx(
        TOKEN_PROGRAM_ID,
        [],
        new Uint8Array([]), // empty data
      );

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data).toEqual({});
    });

    it("returns SPL with empty data when SPL program is seen but discriminator is unknown", () => {
      const msg = singleIx(
        TOKEN_PROGRAM_ID,
        [pk()],
        new Uint8Array([255]), // unknown discriminator
      );

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data).toEqual({});
    });

    it("skips instructions whose programIdIndex is out of range", () => {
      // Manually craft a message with a bad programIdIndex
      const msg: NormalizedMessage = {
        allKeys: [SystemProgram.programId],
        compiledInstructions: [
          {
            programIdIndex: 99, // out of range
            accountKeyIndexes: [],
            data: new Uint8Array([3]),
          },
        ],
      };

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
      expect(result.data).toEqual({});
    });

    it("handles mixed SPL and non-SPL instructions, returning SPL data from the SPL one", () => {
      const destination = pk();

      const msg = buildMessage([
        {
          programId: SystemProgram.programId,
          accounts: [pk(), pk()],
          data: new Uint8Array([2, 0, 0, 0]),
        },
        {
          programId: TOKEN_PROGRAM_ID,
          accounts: [pk(), destination, pk()],
          data: new Uint8Array([3]), // Transfer
        },
      ]);

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
      expect(result.data.tokenAddress).toBe(destination.toBase58());
    });

    it("returns STANDARD for an empty message (no instructions)", () => {
      const msg: NormalizedMessage = {
        allKeys: [],
        compiledInstructions: [],
      };

      const result = classify(msg);

      expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
      expect(result.data).toEqual({});
    });
  });
});

// ---------------------------------------------------------------------------
// extractSPLData()
// ---------------------------------------------------------------------------

describe("extractSPLData", () => {
  /**
   * Helper: build a key-lookup function from an array of PublicKeys.
   * Mirrors what `classify` creates for each instruction.
   */
  const keyFn =
    (keys: (PublicKey | undefined)[]) =>
    (idx: number): PublicKey | undefined =>
      keys[idx];

  // ----- Associated Token Program -----

  describe("ASSOCIATED_TOKEN_PROGRAM_ID", () => {
    it("returns createATA with owner (key 2) and mint (key 3)", () => {
      const owner = pk();
      const mint = pk();
      const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const keys = [pk(), ata, owner, mint, pk(), pk()]; // [payer, ata, owner, mint, system, tokenProg]

      const result = extractSPLData(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        keyFn(keys),
        new Uint8Array([]),
      );

      expect(result).toEqual({
        createATA: {
          address: owner.toBase58(),
          mintAddress: mint.toBase58(),
        },
      });
    });

    it("returns null when owner (key 2) is missing", () => {
      const result = extractSPLData(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        keyFn([pk(), pk()]), // only 2 keys, index 2 is undefined
        new Uint8Array([]),
      );

      expect(result).toBeNull();
    });

    it("returns null when mint (key 3) is missing", () => {
      const result = extractSPLData(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        keyFn([pk(), pk(), pk()]), // only 3 keys, index 3 is undefined
        new Uint8Array([]),
      );

      expect(result).toBeNull();
    });
  });

  // ----- Non-token program -----

  describe("non-token program", () => {
    it("returns null for SystemProgram", () => {
      const result = extractSPLData(
        SystemProgram.programId,
        keyFn([pk()]),
        new Uint8Array([3]),
      );

      expect(result).toBeNull();
    });

    it("returns null for an arbitrary unknown program", () => {
      const result = extractSPLData(pk(), keyFn([pk()]), new Uint8Array([3]));

      expect(result).toBeNull();
    });
  });

  // ----- Empty / unknown data -----

  describe("edge cases on instruction data", () => {
    it("returns null for empty data on TOKEN_PROGRAM_ID", () => {
      const result = extractSPLData(
        TOKEN_PROGRAM_ID,
        keyFn([pk()]),
        new Uint8Array([]),
      );

      expect(result).toBeNull();
    });

    it("returns null for unknown discriminator", () => {
      const result = extractSPLData(
        TOKEN_PROGRAM_ID,
        keyFn([pk()]),
        new Uint8Array([255]),
      );

      expect(result).toBeNull();
    });
  });

  // ----- Transfer (disc 3) -----

  describe("Transfer (disc 3)", () => {
    it.each([TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID])(
      "returns tokenAddress = key(1) for %s",
      (programId) => {
        const destination = pk();
        const result = extractSPLData(
          programId,
          keyFn([pk(), destination, pk()]),
          new Uint8Array([3]),
        );

        expect(result).toEqual({ tokenAddress: destination.toBase58() });
      },
    );

    it("returns null when destination key is missing", () => {
      const result = extractSPLData(
        TOKEN_PROGRAM_ID,
        keyFn([pk()]), // only key 0 → key(1) is undefined
        new Uint8Array([3]),
      );

      expect(result).toBeNull();
    });
  });

  // ----- TransferChecked (disc 12) -----

  describe("TransferChecked (disc 12)", () => {
    it.each([TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID])(
      "returns tokenAddress = key(2) for %s",
      (programId) => {
        const destination = pk();
        const result = extractSPLData(
          programId,
          keyFn([pk(), pk(), destination, pk()]),
          new Uint8Array([12]),
        );

        expect(result).toEqual({ tokenAddress: destination.toBase58() });
      },
    );

    it("returns null when destination key is missing", () => {
      const result = extractSPLData(
        TOKEN_PROGRAM_ID,
        keyFn([pk(), pk()]), // only keys 0,1 → key(2) is undefined
        new Uint8Array([12]),
      );

      expect(result).toBeNull();
    });
  });

  // ----- InitializeAccount variants (disc 1, 16, 18) -----

  describe.each([
    { name: "InitializeAccount", disc: 1 },
    { name: "InitializeAccount2", disc: 16 },
    { name: "InitializeAccount3", disc: 18 },
  ])("$name (disc $disc)", ({ disc }) => {
    it.each([TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID])(
      "returns createATA with account=key(0) and mint=key(1) for %s",
      (programId) => {
        const account = pk();
        const mint = pk();
        const result = extractSPLData(
          programId,
          keyFn([account, mint, pk()]),
          new Uint8Array([disc]),
        );

        expect(result).toEqual({
          createATA: {
            address: account.toBase58(),
            mintAddress: mint.toBase58(),
          },
        });
      },
    );

    it("returns null when mint key is missing", () => {
      const result = extractSPLData(
        TOKEN_PROGRAM_ID,
        keyFn([pk()]), // only key 0 → key(1) is undefined
        new Uint8Array([disc]),
      );

      expect(result).toBeNull();
    });
  });

  // ----- Single-account instructions (key 0) -----

  describe.each([
    { name: "CloseAccount", disc: 9 },
    { name: "SyncNative", disc: 17 },
    { name: "Burn", disc: 8 },
    { name: "BurnChecked", disc: 15 },
    { name: "FreezeAccount", disc: 10 },
    { name: "ThawAccount", disc: 11 },
    { name: "InitializeImmutableOwner", disc: 22 },
  ])("$name (disc $disc)", ({ disc }) => {
    it.each([TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID])(
      "returns tokenAddress = key(0) for %s",
      (programId) => {
        const account = pk();
        const result = extractSPLData(
          programId,
          keyFn([account, pk(), pk()]),
          new Uint8Array([disc]),
        );

        expect(result).toEqual({ tokenAddress: account.toBase58() });
      },
    );

    it("returns null when key(0) is missing", () => {
      const result = extractSPLData(
        TOKEN_PROGRAM_ID,
        keyFn([]), // no keys
        new Uint8Array([disc]),
      );

      expect(result).toBeNull();
    });
  });

  // ----- TransferFeeExtension / TransferCheckedWithFee (disc 26) -----

  describe("TransferFeeExtension (disc 26)", () => {
    it("returns tokenAddress = key(2) when sub-instruction is TransferCheckedWithFee (1)", () => {
      const destination = pk();
      const result = extractSPLData(
        TOKEN_2022_PROGRAM_ID,
        keyFn([pk(), pk(), destination, pk()]),
        new Uint8Array([26, 1]), // disc 26, sub 1
      );

      expect(result).toEqual({ tokenAddress: destination.toBase58() });
    });

    it("returns null when sub-instruction is not TransferCheckedWithFee", () => {
      const result = extractSPLData(
        TOKEN_2022_PROGRAM_ID,
        keyFn([pk(), pk(), pk(), pk()]),
        new Uint8Array([26, 0]), // disc 26, sub 0
      );

      expect(result).toBeNull();
    });

    it("returns null when data has disc 26 but no sub-instruction byte", () => {
      const result = extractSPLData(
        TOKEN_2022_PROGRAM_ID,
        keyFn([pk(), pk(), pk(), pk()]),
        new Uint8Array([26]), // only 1 byte
      );

      expect(result).toBeNull();
    });

    it("returns null for destination key missing with valid sub-instruction", () => {
      const result = extractSPLData(
        TOKEN_2022_PROGRAM_ID,
        keyFn([pk(), pk()]), // only keys 0,1 → key(2) undefined
        new Uint8Array([26, 1]),
      );

      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// extractValidatedATA – ATA derivation validation
// ---------------------------------------------------------------------------

describe("extractValidatedATA", () => {
  const keyFn =
    (keys: (PublicKey | undefined)[]) =>
    (idx: number): PublicKey | undefined =>
      keys[idx];

  it("returns createATA when the ATA is derived via classic Token Program", () => {
    const owner = pk();
    const mint = pk();
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const result = extractValidatedATA(keyFn([pk(), ata, owner, mint]));

    expect(result).toEqual({
      createATA: {
        address: owner.toBase58(),
        mintAddress: mint.toBase58(),
      },
    });
  });

  it("returns createATA when the ATA is derived via Token-2022 Program", () => {
    const owner = pk();
    const mint = pk();
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const result = extractValidatedATA(keyFn([pk(), ata, owner, mint]));

    expect(result).toEqual({
      createATA: {
        address: owner.toBase58(),
        mintAddress: mint.toBase58(),
      },
    });
  });

  it("returns null when the ATA does not match the derivation (non-canonical layout)", () => {
    const owner = pk();
    const mint = pk();
    const fakeAta = pk(); // random key that won't match derivation

    const result = extractValidatedATA(keyFn([pk(), fakeAta, owner, mint]));

    expect(result).toBeNull();
  });

  it("returns null when the ATA key (index 1) is missing", () => {
    const result = extractValidatedATA(keyFn([pk()]));

    expect(result).toBeNull();
  });

  it("returns null when the owner key (index 2) is missing", () => {
    const result = extractValidatedATA(keyFn([pk(), pk()]));

    expect(result).toBeNull();
  });

  it("returns null when the mint key (index 3) is missing", () => {
    const result = extractValidatedATA(keyFn([pk(), pk(), pk()]));

    expect(result).toBeNull();
  });
});
