import { describe, expect, it } from "vitest";

import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

import {
  BlindSignReason,
  computeSigningContext,
  DEVICE_RECOGNIZED_PROGRAMS,
  MAX_DEVICE_INSTRUCTIONS,
} from "./computeSigningContext";

/** Helper to build a minimal TxInspectorResult */
function makeResult(
  overrides: Partial<TxInspectorResult> = {},
): TxInspectorResult {
  return {
    transactionType: SolanaTransactionTypes.STANDARD,
    data: {},
    programIds: ["11111111111111111111111111111111"],
    instructionCount: 1,
    usesAddressLookupTables: false,
    ...overrides,
  };
}

describe("computeSigningContext", () => {
  it("returns isBlindSign: false for a simple SOL transfer (recognized program, ≤6 ix, no ALTs)", () => {
    const result = computeSigningContext(
      makeResult({
        programIds: ["11111111111111111111111111111111"],
        instructionCount: 1,
      }),
    );

    expect(result.isBlindSign).toBe(false);
    expect(result.reason).toBe(BlindSignReason.None);
    expect(result.unrecognizedPrograms).toEqual([]);
  });

  it("returns isBlindSign: false when all programs are recognized and instruction count is exactly 6", () => {
    const result = computeSigningContext(
      makeResult({
        programIds: [
          "11111111111111111111111111111111",
          "Stake11111111111111111111111111111111",
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        ],
        instructionCount: 6,
      }),
    );

    expect(result.isBlindSign).toBe(false);
    expect(result.reason).toBe(BlindSignReason.None);
  });

  it("returns isBlindSign: true with reason 'unrecognized_program' for an unknown program", () => {
    const jupiterId = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
    const result = computeSigningContext(
      makeResult({
        programIds: [
          "11111111111111111111111111111111",
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          jupiterId,
        ],
        instructionCount: 4,
      }),
    );

    expect(result.isBlindSign).toBe(true);
    expect(result.reason).toBe(BlindSignReason.UnrecognizedProgram);
    expect(result.unrecognizedPrograms).toEqual([jupiterId]);
  });

  it("returns isBlindSign: true with reason 'too_many_instructions' when > 6 instructions", () => {
    const result = computeSigningContext(
      makeResult({
        programIds: ["11111111111111111111111111111111"],
        instructionCount: 7,
      }),
    );

    expect(result.isBlindSign).toBe(true);
    expect(result.reason).toBe(BlindSignReason.TooManyInstructions);
    expect(result.unrecognizedPrograms).toEqual([]);
  });

  it("returns isBlindSign: true with reason 'address_lookup_tables' when ALTs are present", () => {
    const result = computeSigningContext(
      makeResult({
        programIds: ["11111111111111111111111111111111"],
        instructionCount: 2,
        usesAddressLookupTables: true,
      }),
    );

    expect(result.isBlindSign).toBe(true);
    expect(result.reason).toBe(BlindSignReason.AddressLookupTables);
  });

  it("prioritises ALTs over too many instructions", () => {
    const result = computeSigningContext(
      makeResult({
        instructionCount: 10,
        usesAddressLookupTables: true,
      }),
    );

    expect(result.reason).toBe(BlindSignReason.AddressLookupTables);
  });

  it("prioritises too many instructions over unrecognized program", () => {
    const unknownId = "UnknownProgram111111111111111111111111";
    const result = computeSigningContext(
      makeResult({
        programIds: [unknownId],
        instructionCount: 8,
      }),
    );

    expect(result.reason).toBe(BlindSignReason.TooManyInstructions);
  });

  it("identifies multiple unrecognized programs", () => {
    const unknownA = "UnknownA111111111111111111111111111111";
    const unknownB = "UnknownB111111111111111111111111111111";
    const result = computeSigningContext(
      makeResult({
        programIds: [
          "11111111111111111111111111111111",
          unknownA,
          unknownB,
        ],
        instructionCount: 3,
      }),
    );

    expect(result.isBlindSign).toBe(true);
    expect(result.reason).toBe(BlindSignReason.UnrecognizedProgram);
    expect(result.unrecognizedPrograms).toEqual([unknownA, unknownB]);
  });

  it("passes through programIds and instructionCount unchanged", () => {
    const ids = [
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ];
    const result = computeSigningContext(
      makeResult({ programIds: ids, instructionCount: 5 }),
    );

    expect(result.programIds).toEqual(ids);
    expect(result.instructionCount).toBe(5);
  });

  it("handles empty programIds (e.g. parse failure fallback)", () => {
    const result = computeSigningContext(
      makeResult({ programIds: [], instructionCount: 0 }),
    );

    expect(result.isBlindSign).toBe(false);
    expect(result.reason).toBe(BlindSignReason.None);
    expect(result.unrecognizedPrograms).toEqual([]);
  });
});

describe("DEVICE_RECOGNIZED_PROGRAMS", () => {
  it("contains all 10 expected programs", () => {
    expect(DEVICE_RECOGNIZED_PROGRAMS.size).toBe(10);
  });

  it.each([
    ["System", "11111111111111111111111111111111"],
    ["Stake", "Stake11111111111111111111111111111111"],
    ["Vote", "Vote111111111111111111111111111111111"],
    ["SPL Token", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    ["SPL Token 2022", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"],
    ["ATA", "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"],
    ["SPL Memo", "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"],
    ["Compute Budget", "ComputeBudget111111111111111111111111111"],
    ["Serum Assert Owner", "4MNPdKu9wFMvEeZBMt3Eipfs5ovVWTJb31pEXDJAAxX5"],
    ["Serum Assert Owner (Phantom)", "DeJBGdMFa1uynnnKiwrVioatTuHmNLpyFKnmB5kaFdzQ"],
  ])("recognises %s (%s)", (_name, address) => {
    expect(DEVICE_RECOGNIZED_PROGRAMS.has(address)).toBe(true);
  });

  it("does not recognise an arbitrary program", () => {
    expect(
      DEVICE_RECOGNIZED_PROGRAMS.has(
        "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      ),
    ).toBe(false);
  });
});

describe("MAX_DEVICE_INSTRUCTIONS", () => {
  it("equals 6", () => {
    expect(MAX_DEVICE_INSTRUCTIONS).toBe(6);
  });
});
