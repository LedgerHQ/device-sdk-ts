import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedMessage,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { type AddressLookupTableResolver } from "./AddressLookupTableResolver";
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

describe("TransactionParser", () => {
  it("parses a legacy transaction and returns a normalised message", async () => {
    const payer = Keypair.generate();
    const dest = Keypair.generate().publicKey;

    const raw = makeSignedRawTx(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: dest,
          lamports: 1_000,
        }),
      ],
      payer,
    );

    const parser = new TransactionParser();
    const result = await parser.parse(raw);

    expect(result.usesAddressLookupTables).toBe(false);
    expect(result.message.compiledInstructions).toHaveLength(1);
    expect(result.message.allKeys.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves instruction count across multiple instructions", async () => {
    const payer = Keypair.generate();

    const raw = makeSignedRawTx(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1_000,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 2_000,
        }),
      ],
      payer,
    );

    const parser = new TransactionParser();
    const result = await parser.parse(raw);

    expect(result.message.compiledInstructions).toHaveLength(2);
  });

  it("throws on garbage bytes", async () => {
    const parser = new TransactionParser();
    const garbage = new Uint8Array([0xab, 0xad, 0xbe, 0xef]);

    await expect(parser.parse(garbage)).rejects.toThrow();
  });

  it("calls the ALT resolver but still works when it returns undefined", async () => {
    const resolver: AddressLookupTableResolver = {
      resolve: vi.fn().mockResolvedValue(undefined),
    };

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

    const parser = new TransactionParser(resolver);
    const result = await parser.parse(raw);

    // Resolver may be called (legacy bytes can also parse as versioned),
    // but the result is still valid.
    expect(result.usesAddressLookupTables).toBe(false);
    expect(result.message.compiledInstructions).toHaveLength(1);
  });

  describe("hasAddressLookupTables (static)", () => {
    it("returns false for legacy transactions", () => {
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

      expect(TransactionParser.hasAddressLookupTables(raw)).toBe(false);
    });

    it("returns false for garbage bytes", () => {
      expect(
        TransactionParser.hasAddressLookupTables(
          new Uint8Array([0xab, 0xad, 0xbe, 0xef]),
        ),
      ).toBe(false);
    });
  });
});
