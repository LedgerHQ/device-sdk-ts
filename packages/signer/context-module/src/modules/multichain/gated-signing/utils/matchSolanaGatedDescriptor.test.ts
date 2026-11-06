import { createHash } from "node:crypto";

import { type SolanaGatedDescriptor } from "@/modules/multichain/gated-signing/data/SolanaGatedDescriptorDataSource";

import {
  findSolanaGatedDescriptor,
  matchesSolanaGatedDescriptor,
  type SolanaGatedSigningInstruction,
} from "./matchSolanaGatedDescriptor";

const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const SYSTEM = "11111111111111111111111111111111";
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// The three discriminator schemes CAL has to produce.
const anchor = (name: string) =>
  new Uint8Array(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
const u32le = (index: number) =>
  new Uint8Array([
    index & 0xff,
    (index >> 8) & 0xff,
    (index >> 16) & 0xff,
    (index >> 24) & 0xff,
  ]);
const u8 = (index: number) => new Uint8Array([index]);

const descriptor = (
  programId: string,
  discriminator: Uint8Array = new Uint8Array(),
  signedDescriptor = `descriptor-${programId}-${discriminator.length}`,
): SolanaGatedDescriptor => ({ programId, discriminator, signedDescriptor });

const instruction = (
  programId: string,
  ...chunks: Uint8Array[]
): SolanaGatedSigningInstruction => {
  const data = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return { programId, data };
};

const args = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);

describe("matchesSolanaGatedDescriptor", () => {
  describe("program only", () => {
    const programOnly = descriptor(JUPITER);

    it("matches any instruction of the program", () => {
      expect(
        matchesSolanaGatedDescriptor(
          programOnly,
          instruction(JUPITER, anchor("route"), args),
        ),
      ).toBe(true);
      expect(
        matchesSolanaGatedDescriptor(
          programOnly,
          instruction(JUPITER, anchor("shared_accounts_route"), args),
        ),
      ).toBe(true);
    });

    it("matches an instruction with no data", () => {
      expect(
        matchesSolanaGatedDescriptor(programOnly, instruction(JUPITER)),
      ).toBe(true);
    });

    it("does not match another program", () => {
      expect(
        matchesSolanaGatedDescriptor(
          programOnly,
          instruction(SYSTEM, u32le(2)),
        ),
      ).toBe(false);
    });
  });

  describe("program and instruction", () => {
    it.each([
      ["Anchor (8 bytes)", JUPITER, anchor("route")],
      ["System (4 bytes)", SYSTEM, u32le(2)],
      ["SPL Token (1 byte)", SPL_TOKEN, u8(12)],
    ])(
      "%s: matches when the data starts with the discriminator",
      (_, programId, discriminator) => {
        expect(
          matchesSolanaGatedDescriptor(
            descriptor(programId, discriminator),
            instruction(programId, discriminator, args),
          ),
        ).toBe(true);
      },
    );

    it("matches when the data is exactly the discriminator", () => {
      expect(
        matchesSolanaGatedDescriptor(
          descriptor(SYSTEM, u32le(2)),
          instruction(SYSTEM, u32le(2)),
        ),
      ).toBe(true);
    });

    it("does not match another instruction of the program", () => {
      expect(
        matchesSolanaGatedDescriptor(
          descriptor(JUPITER, anchor("route")),
          instruction(JUPITER, anchor("shared_accounts_route"), args),
        ),
      ).toBe(false);
      expect(
        matchesSolanaGatedDescriptor(
          descriptor(SYSTEM, u32le(2)),
          instruction(SYSTEM, u32le(3), args),
        ),
      ).toBe(false);
    });

    it("does not match data shorter than the discriminator", () => {
      const route = anchor("route");
      expect(
        matchesSolanaGatedDescriptor(
          descriptor(JUPITER, route),
          instruction(JUPITER, route.subarray(0, 7)),
        ),
      ).toBe(false);
      expect(
        matchesSolanaGatedDescriptor(
          descriptor(JUPITER, route),
          instruction(JUPITER),
        ),
      ).toBe(false);
    });

    it("does not match the same bytes in another program", () => {
      expect(
        matchesSolanaGatedDescriptor(
          descriptor(JUPITER, anchor("route")),
          instruction(SPL_TOKEN, anchor("route"), args),
        ),
      ).toBe(false);
    });
  });
});

describe("findSolanaGatedDescriptor", () => {
  // A typical swap: compute budget, ATA creation, the partner swap, a tip.
  const swap = [
    instruction(COMPUTE_BUDGET, u8(2), args),
    instruction(ATA, u8(1)),
    instruction(JUPITER, anchor("route"), args),
    instruction(SYSTEM, u32le(2), args),
  ];

  it("matches when one instruction among others calls the gated program", () => {
    const gated = descriptor(JUPITER, anchor("route"));

    expect(findSolanaGatedDescriptor(swap, [gated])).toEqual({
      descriptor: gated,
      instructionIndex: 2,
    });
  });

  it("returns null when no instruction matches", () => {
    expect(
      findSolanaGatedDescriptor(swap, [
        descriptor(JUPITER, anchor("shared_accounts_route")),
        descriptor("Partner1111111111111111111111111111111111111"),
      ]),
    ).toBeNull();
  });

  it("returns null without descriptors or instructions", () => {
    expect(findSolanaGatedDescriptor(swap, [])).toBeNull();
    expect(findSolanaGatedDescriptor([], [descriptor(JUPITER)])).toBeNull();
  });

  it("picks the first matching instruction in message order", () => {
    const tip = descriptor(SYSTEM, u32le(2));
    const route = descriptor(JUPITER, anchor("route"));

    expect(findSolanaGatedDescriptor(swap, [tip, route])).toEqual({
      descriptor: route,
      instructionIndex: 2,
    });
  });

  it("prefers program and instruction over program only", () => {
    const programOnly = descriptor(JUPITER);
    const route = descriptor(JUPITER, anchor("route"));

    expect(findSolanaGatedDescriptor(swap, [programOnly, route])).toEqual({
      descriptor: route,
      instructionIndex: 2,
    });
    expect(findSolanaGatedDescriptor(swap, [route, programOnly])).toEqual({
      descriptor: route,
      instructionIndex: 2,
    });
  });

  it("falls back to program only when the instruction is not listed", () => {
    const programOnly = descriptor(JUPITER);
    const other = descriptor(JUPITER, anchor("shared_accounts_route"));

    expect(findSolanaGatedDescriptor(swap, [other, programOnly])).toEqual({
      descriptor: programOnly,
      instructionIndex: 2,
    });
  });
});
