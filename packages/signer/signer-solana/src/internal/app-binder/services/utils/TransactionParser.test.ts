import {
  AddressLookupTableAccount,
  Keypair,
  Message,
  MessageV0,
  type PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
  TransactionMessage,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import {
  SEND_WITH_MEMO_MESSAGE,
  UNSTAKE_MESSAGE,
  withOneSignature,
} from "@internal/app-binder/services/__test-utils__/ambiguousMessages";
import {
  encodeV1Message,
  filledAddress,
  MAINNET_V1_MESSAGE_288,
  MAINNET_V1_MESSAGE_675,
  SPEC_V1_INPUT,
  SPEC_V1_MESSAGE,
  SPEC_V1_OFFSETS,
  withByte,
  withBytes,
  withTrailingBytes,
} from "@internal/app-binder/services/__test-utils__/v1Fixtures";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import {
  type AddressLookupTableResolver,
  type LoadedAddresses,
} from "./AddressLookupTableResolver";
import {
  AccountIndexOutOfRangeError,
  EmptyInstructionsError,
  InvalidV1MessageError,
  InvalidVersionError,
  MalformedTransactionError,
  MAX_ACCOUNTS_PER_INSTRUCTION,
  OversizedAccountArrayError,
  TruncatedTransactionError,
} from "./ParserError";
import {
  buildCompiledInstructions,
  TransactionParser,
} from "./TransactionParser";

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

/**
 * Builds a v0 transaction that pretends to use an ALT — useful for tests
 * that exercise ALT resolution without standing up a real on-chain table.
 */
function makeV0TxWithFakeAlt(opts: {
  payer: Keypair;
  staticIxs: TransactionInstruction[];
  altKey: PublicKey;
  altEntries: PublicKey[];
  writableEntryIndexes: number[];
  readonlyEntryIndexes: number[];
  altIxs: { programId: PublicKey; accountAddresses: PublicKey[] }[];
}): Uint8Array {
  const lookupAccount = new AddressLookupTableAccount({
    key: opts.altKey,
    state: {
      deactivationSlot: BigInt("18446744073709551615"),
      lastExtendedSlot: 0,
      lastExtendedSlotStartIndex: 0,
      authority: opts.payer.publicKey,
      addresses: opts.altEntries,
    },
  });

  const writableSet = new Set(opts.writableEntryIndexes);
  const readonlySet = new Set(opts.readonlyEntryIndexes);

  const altIxs: TransactionInstruction[] = opts.altIxs.map((spec) => ({
    programId: spec.programId,
    keys: spec.accountAddresses.map((addr) => {
      const entryIdx = opts.altEntries.findIndex((e) => e.equals(addr));
      const isFromAlt = entryIdx >= 0;
      return {
        pubkey: addr,
        isSigner: false,
        isWritable: isFromAlt
          ? writableSet.has(entryIdx)
          : !readonlySet.has(entryIdx),
      };
    }),
    data: Buffer.from([]),
  }));

  const message = new TransactionMessage({
    payerKey: opts.payer.publicKey,
    recentBlockhash: DUMMY_BLOCKHASH,
    instructions: [...opts.staticIxs, ...altIxs],
  }).compileToV0Message([lookupAccount]);

  const vt = new VersionedTransaction(message);
  vt.sign([opts.payer]);
  return vt.serialize();
}

describe("TransactionParser", () => {
  describe("legacy transactions", () => {
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
      const result = (await parser.parse(raw).run()).unsafeCoerce();

      expect(result.usesAddressLookupTables).toBe(false);
      expect(result.message.compiledInstructions).toHaveLength(1);
      expect(result.message.allKeys.length).toBeGreaterThanOrEqual(2);
      expect(result.message.addressLookupRefs).toBeUndefined();
    });

    it("derives writable flags from the message header (signer-fee-payer is writable)", async () => {
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
      const { message } = (await parser.parse(raw).run()).unsafeCoerce();
      const ix = message.compiledInstructions[0]!;

      expect(ix.accountWritable).toHaveLength(ix.accountKeyIndexes.length);
      // The fee-payer slot of SystemProgram.transfer (from) is signer + writable.
      const payerIdx = message.allKeys.findIndex((k) =>
        k.equals(payer.publicKey),
      );
      const payerSlot = ix.accountKeyIndexes.indexOf(payerIdx);
      expect(payerSlot).toBeGreaterThanOrEqual(0);
      expect(ix.accountWritable[payerSlot]).toBe(true);

      // The SystemProgram itself is always non-writable.
      const programIdx = message.allKeys.findIndex((k) =>
        k.equals(SystemProgram.programId),
      );
      expect(programIdx).toBeGreaterThanOrEqual(0);
      // programIdIndex points to it; programs are never writable per Solana rules.
      // (We don't surface a separate flag for the program — just verify the
      //  writable map agrees by reusing it across the destination slot.)
      const destIdx = message.allKeys.findIndex((k) => k.equals(dest));
      const destSlot = ix.accountKeyIndexes.indexOf(destIdx);
      expect(destSlot).toBeGreaterThanOrEqual(0);
      expect(ix.accountWritable[destSlot]).toBe(true);
    });

    it("derives signer flags from the message header (fee-payer is a signer; recipient is not)", async () => {
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
      const { message } = (await parser.parse(raw).run()).unsafeCoerce();
      const ix = message.compiledInstructions[0]!;

      expect(ix.accountSigner).toHaveLength(ix.accountKeyIndexes.length);
      // The fee payer is the only required signer.
      const payerIdx = message.allKeys.findIndex((k) =>
        k.equals(payer.publicKey),
      );
      const payerSlot = ix.accountKeyIndexes.indexOf(payerIdx);
      expect(ix.accountSigner[payerSlot]).toBe(true);

      // The destination account is writable but not a signer.
      const destIdx = message.allKeys.findIndex((k) => k.equals(dest));
      const destSlot = ix.accountKeyIndexes.indexOf(destIdx);
      expect(ix.accountSigner[destSlot]).toBe(false);
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
      const { message } = (await parser.parse(raw).run()).unsafeCoerce();

      expect(message.compiledInstructions).toHaveLength(2);
      for (const ix of message.compiledInstructions) {
        expect(ix.accountWritable).toHaveLength(ix.accountKeyIndexes.length);
      }
    });
  });

  describe("malformed input (returns typed errors, never throws)", () => {
    it("returns TruncatedTransactionError for an obviously short buffer", async () => {
      const parser = new TransactionParser();
      const tiny = new Uint8Array([0xab, 0xad, 0xbe, 0xef]);

      const result = await parser.parse(tiny).run();

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(
        TruncatedTransactionError,
      );
    });

    it("returns InvalidVersionError when the version byte is unsupported", async () => {
      const parser = new TransactionParser();
      // 0x80 = version 0 and 0x81 = version 1 (both supported). 0x82 = version 2.
      const bytes = new Uint8Array(80);
      bytes[0] = 0x82;

      const result = await parser.parse(bytes).run();

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(InvalidVersionError);
    });

    it("returns EmptyInstructionsError when the decoded message has zero instructions", async () => {
      const payer = Keypair.generate();
      const message = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: DUMMY_BLOCKHASH,
        instructions: [],
      }).compileToV0Message();
      const vt = new VersionedTransaction(message);
      vt.sign([payer]);
      const raw = vt.serialize();

      const parser = new TransactionParser();
      const result = await parser.parse(raw).run();

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(
        EmptyInstructionsError,
      );
    });

    it("returns AccountIndexOutOfRangeError when an instruction references a key past the logical count", async () => {
      const payer = Keypair.generate();
      const messageBase = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: DUMMY_BLOCKHASH,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: Keypair.generate().publicKey,
            lamports: 1,
          }),
        ],
      }).compileToV0Message();

      // Tamper with the compiled message in-place: push a bogus account index.
      const tampered = new MessageV0({
        header: messageBase.header,
        staticAccountKeys: messageBase.staticAccountKeys,
        recentBlockhash: messageBase.recentBlockhash,
        compiledInstructions: messageBase.compiledInstructions.map((ci, i) =>
          i === 0
            ? {
                ...ci,
                accountKeyIndexes: [...ci.accountKeyIndexes, 250],
              }
            : ci,
        ),
        addressTableLookups: messageBase.addressTableLookups,
      });
      const vt = new VersionedTransaction(tampered);
      vt.sign([payer]);
      const raw = vt.serialize();

      const parser = new TransactionParser();
      const result = await parser.parse(raw).run();

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(
        AccountIndexOutOfRangeError,
      );
    });

    it("returns MalformedTransactionError when bytes pass the length guard but decode fails", async () => {
      // Long enough to clear MIN_MESSAGE_BYTES, with a v0 prefix (version 0,
      // so the version guard passes), but the remaining bytes are garbage that
      // neither the versioned nor the legacy decoder can parse.
      const garbage = new Uint8Array(80).fill(0xff);
      garbage[0] = 0x80;

      const result = await new TransactionParser().parse(garbage).run();

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(
        MalformedTransactionError,
      );
    });

    it("returns OversizedAccountArrayError when an instruction declares more than 256 accounts", () => {
      // Exercise the guard directly through the exported helper: web3.js may
      // refuse to serialise a tampered oversize instruction, so going through
      // `parse()` would be non-deterministic. The instruction references a
      // single valid key index, so the oversize check fires before the
      // per-slot bounds check.
      const oversize = Array.from(
        { length: MAX_ACCOUNTS_PER_INSTRUCTION + 1 },
        () => 0,
      );

      const result = buildCompiledInstructions(
        [
          {
            programIdIndex: 0,
            accountKeyIndexes: oversize,
            data: new Uint8Array(),
          },
        ],
        [true],
        1,
      );

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(
        OversizedAccountArrayError,
      );
    });
  });

  describe("compiled instructions", () => {
    it("GIVEN instruction data as a base64 string WHEN building compiled instructions THEN it decodes bytes", () => {
      // GIVEN
      const compiledInstructions = [
        {
          programIdIndex: 0,
          accountKeyIndexes: [0],
          data: "AQID/w==" as unknown as Uint8Array,
        },
      ];

      // WHEN
      const result = buildCompiledInstructions(compiledInstructions, [true], 1);

      // THEN
      expect(result.isRight()).toBe(true);
      expect(result.unsafeCoerce()[0]?.data).toStrictEqual(
        Uint8Array.from([1, 2, 3, 255]),
      );
    });
  });

  describe("address lookup tables", () => {
    it("resolves ALT entries when a resolver is provided (existing behaviour)", async () => {
      const payer = Keypair.generate();
      const altKey = Keypair.generate().publicKey;
      const altEntries = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      const raw = makeV0TxWithFakeAlt({
        payer,
        staticIxs: [],
        altKey,
        altEntries,
        writableEntryIndexes: [0],
        readonlyEntryIndexes: [1],
        altIxs: [
          {
            programId: SystemProgram.programId,
            accountAddresses: [altEntries[0]!, altEntries[1]!],
          },
        ],
      });

      const resolver: AddressLookupTableResolver = {
        resolve: vi.fn().mockResolvedValue({
          writable: [altEntries[0]!],
          readonly: [altEntries[1]!],
        } satisfies LoadedAddresses),
      };

      const parser = new TransactionParser(resolver);
      const { message } = (await parser.parse(raw).run()).unsafeCoerce();

      expect(message.addressLookupRefs).toBeUndefined();
      expect(message.allKeys.some((k) => k.equals(altEntries[0]!))).toBe(true);
      expect(message.allKeys.some((k) => k.equals(altEntries[1]!))).toBe(true);
    });

    it("preserves raw ALT refs when no resolver is provided and preserveAltRefs=true", async () => {
      const payer = Keypair.generate();
      const altKey = Keypair.generate().publicKey;
      const altEntries = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      const raw = makeV0TxWithFakeAlt({
        payer,
        staticIxs: [],
        altKey,
        altEntries,
        writableEntryIndexes: [0],
        readonlyEntryIndexes: [1],
        altIxs: [
          {
            programId: SystemProgram.programId,
            accountAddresses: [altEntries[0]!, altEntries[1]!],
          },
        ],
      });

      const parser = new TransactionParser(undefined, {
        preserveAltRefs: true,
      });
      const { message, usesAddressLookupTables } = (
        await parser.parse(raw).run()
      ).unsafeCoerce();

      expect(usesAddressLookupTables).toBe(true);
      expect(message.addressLookupRefs).toBeDefined();
      const refs = message.addressLookupRefs!;

      // Static prefix slots have no refs.
      const staticLen = message.allKeys.findIndex(
        (_k, i) => refs[i] !== undefined,
      );
      expect(staticLen).toBeGreaterThan(0);
      // All ALT slots reference our fake table.
      for (let i = staticLen; i < message.allKeys.length; i++) {
        expect(refs[i]).toBeDefined();
        expect(refs[i]!.altAddress.equals(altKey)).toBe(true);
      }
      // First ALT slot is the writable entry (index 0), then the readonly (1).
      expect(refs[staticLen]!.entryIndex).toBe(0);
      expect(refs[staticLen + 1]!.entryIndex).toBe(1);

      // Writable flag follows the lookup writable/readonly split.
      const ix = message.compiledInstructions[0]!;
      const altWritableSlot = ix.accountKeyIndexes.indexOf(staticLen);
      const altReadonlySlot = ix.accountKeyIndexes.indexOf(staticLen + 1);
      expect(ix.accountWritable[altWritableSlot]).toBe(true);
      expect(ix.accountWritable[altReadonlySlot]).toBe(false);

      // ALT-supplied slots are never required signers, regardless of the
      // writable/readonly split — only static slots can be.
      expect(ix.accountSigner[altWritableSlot]).toBe(false);
      expect(ix.accountSigner[altReadonlySlot]).toBe(false);
    });

    it("does not preserve raw refs by default (no resolver, no opt-in)", async () => {
      const payer = Keypair.generate();
      const altKey = Keypair.generate().publicKey;
      const altEntries = [Keypair.generate().publicKey];

      const raw = makeV0TxWithFakeAlt({
        payer,
        staticIxs: [],
        altKey,
        altEntries,
        writableEntryIndexes: [0],
        readonlyEntryIndexes: [],
        altIxs: [
          {
            programId: SystemProgram.programId,
            accountAddresses: [altEntries[0]!],
          },
        ],
      });

      const parser = new TransactionParser(); // no resolver, default options
      const { message } = (await parser.parse(raw).run()).unsafeCoerce();

      // Existing behaviour: ALT-derived keys are not surfaced on `allKeys`
      // and no `addressLookupRefs` are emitted unless the caller opts in.
      expect(message.addressLookupRefs).toBeUndefined();
      // allKeys is still indexable; ALT-resolved slots are simply absent.
      expect(message.allKeys.some((k) => k.equals(altEntries[0]!))).toBe(false);
    });
  });

  describe("ALT resolver wiring", () => {
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
      const result = (await parser.parse(raw).run()).unsafeCoerce();

      expect(result.usesAddressLookupTables).toBe(false);
      expect(result.message.compiledInstructions).toHaveLength(1);
    });
  });

  describe("hasAddressLookupTables", () => {
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

      const parser = new TransactionParser();
      expect(parser.hasAddressLookupTables(raw)).toBe(false);
    });

    it("returns false for garbage bytes", () => {
      const parser = new TransactionParser();
      expect(
        parser.hasAddressLookupTables(new Uint8Array([0xab, 0xad, 0xbe, 0xef])),
      ).toBe(false);
    });
  });

  describe("raw messages a lenient decoder also reads as signed transactions", () => {
    it.each([
      [
        "unstake",
        UNSTAKE_MESSAGE,
        [
          "ComputeBudget111111111111111111111111111111",
          "Stake11111111111111111111111111111111111111",
        ],
      ],
      [
        "send with memo",
        SEND_WITH_MEMO_MESSAGE,
        [
          "ComputeBudget111111111111111111111111111111",
          "11111111111111111111111111111111",
          "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
        ],
      ],
    ])("parses the %s message as a message", async (_, message, programIds) => {
      // Precondition: web3.js reads it as a one-signature transaction.
      expect(() => VersionedTransaction.deserialize(message)).not.toThrow();

      const result = (
        await new TransactionParser().parse(message).run()
      ).unsafeCoerce();

      expect(
        result.message.compiledInstructions.map((ix) =>
          result.message.allKeys[ix.programIdIndex]!.toBase58(),
        ),
      ).toEqual(programIds);
      expect(result.message.allKeys).toHaveLength(5);
    });

    it("parses the message out of its signed wire format", async () => {
      const result = (
        await new TransactionParser()
          .parse(withOneSignature(UNSTAKE_MESSAGE))
          .run()
      ).unsafeCoerce();

      expect(result.message.compiledInstructions).toHaveLength(2);
      expect(result.message.allKeys).toHaveLength(5);
    });
  });

  describe("v1 messages", () => {
    const SYSTEM_PROGRAM = "11111111111111111111111111111111";
    const parseV1 = (bytes: Uint8Array, parser = new TransactionParser()) =>
      parser.parse(bytes).run();

    it("maps the spec worked example onto the normalised model", async () => {
      const result = (await parseV1(SPEC_V1_MESSAGE)).unsafeCoerce();

      expect(result.usesAddressLookupTables).toBe(false);
      expect(result.message.addressLookupRefs).toBeUndefined();
      expect(result.message.allKeys.map((key) => key.toBase58())).toEqual([
        "29d2S7vB453rNYFdR5Ycwt7y9haRT5fwVwL9zTmBhfV2",
        "3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3",
        SYSTEM_PROGRAM,
      ]);
      expect(result.message.compiledInstructions).toEqual([
        {
          programIdIndex: 2,
          accountKeyIndexes: [0, 1],
          accountWritable: [true, true],
          accountSigner: [true, false],
          data: new Uint8Array([2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]),
        },
      ]);
    });

    it("parses the message out of its wire format, like legacy and v0", async () => {
      const wire = withTrailingBytes(
        SPEC_V1_MESSAGE,
        new Array<number>(64).fill(0x44),
      );

      const fromWire = (await parseV1(wire)).unsafeCoerce();
      const fromMessage = (await parseV1(SPEC_V1_MESSAGE)).unsafeCoerce();

      expect(fromWire).toEqual(fromMessage);
    });

    it("keeps every instruction's accounts and data, including data over 255 bytes", async () => {
      const longData = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);
      const bytes = encodeV1Message({
        ...SPEC_V1_INPUT,
        instructions: [
          { programIndex: 2, accounts: [0, 1], data: [1, 2, 3] },
          { programIndex: 2, accounts: [], data: longData },
          { programIndex: 1, accounts: [2, 0, 2], data: [] },
        ],
      });

      const { message } = (await parseV1(bytes)).unsafeCoerce();

      expect(
        message.compiledInstructions.map(
          ({ programIdIndex, accountKeyIndexes, data }) => ({
            programIdIndex,
            accountKeyIndexes,
            data,
          }),
        ),
      ).toEqual([
        {
          programIdIndex: 2,
          accountKeyIndexes: [0, 1],
          data: new Uint8Array([1, 2, 3]),
        },
        { programIdIndex: 2, accountKeyIndexes: [], data: longData },
        {
          programIdIndex: 1,
          accountKeyIndexes: [2, 0, 2],
          data: new Uint8Array(),
        },
      ]);
    });

    it.each([
      [
        "675-byte",
        MAINNET_V1_MESSAGE_675,
        [
          "hydHwdP54fiTbJ5QXuKDLZFLY5m8pqx15RSmWcL1yAJ",
          "ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch",
          SYSTEM_PROGRAM,
        ],
      ],
      [
        "288-byte",
        MAINNET_V1_MESSAGE_288,
        [SYSTEM_PROGRAM, "AhoL8CPMN782giCCn8RSixmJXhd8ZCgexUvef1Qy2b7u"],
      ],
    ])(
      "parses the %s mainnet message with its program ids",
      async (_, bytes, programIds) => {
        const { message } = (await parseV1(bytes)).unsafeCoerce();

        expect(
          message.compiledInstructions.map((ix) =>
            message.allKeys[ix.programIdIndex]!.toBase58(),
          ),
        ).toEqual(programIds);
      },
    );

    it("derives signer and writable flags with the legacy header formula", async () => {
      // 3 signers (the last one readonly), then 3 non-signers (the last two
      // readonly). The instruction references every account.
      const header = {
        numRequiredSignatures: 3,
        numReadonlySignedAccounts: 1,
        numReadonlyUnsignedAccounts: 2,
      };
      const addresses = [1, 2, 3, 4, 5, 6].map(filledAddress);
      const bytes = encodeV1Message({
        ...SPEC_V1_INPUT,
        numSignerAccounts: header.numRequiredSignatures,
        numReadonlySignerAccounts: header.numReadonlySignedAccounts,
        numReadonlyNonSignerAccounts: header.numReadonlyUnsignedAccounts,
        addresses,
        instructions: [
          { programIndex: 5, accounts: [0, 1, 2, 3, 4, 5], data: [] },
        ],
      });
      const legacy = new Message({
        header,
        accountKeys: addresses.map((address) =>
          DefaultBs58Encoder.encode(address),
        ),
        recentBlockhash: DUMMY_BLOCKHASH,
        instructions: [],
      });

      const ix = (await parseV1(bytes)).unsafeCoerce().message
        .compiledInstructions[0]!;

      expect(ix.accountSigner).toEqual(
        [0, 1, 2, 3, 4, 5].map((i) => legacy.isAccountSigner(i)),
      );
      expect(ix.accountWritable).toEqual(
        [0, 1, 2, 3, 4, 5].map((i) => legacy.isAccountWritable(i)),
      );
      expect(ix.accountSigner).toEqual([true, true, true, false, false, false]);
      expect(ix.accountWritable).toEqual([
        true,
        true,
        false,
        true,
        false,
        false,
      ]);
    });

    it.each([
      [
        "an unknown config bit",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.configMask, 0x2f),
        "CONFIG_MASK",
      ],
      [
        "duplicate addresses",
        withBytes(
          SPEC_V1_MESSAGE,
          SPEC_V1_OFFSETS.addresses + 32,
          filledAddress(0x11),
        ),
        "DUPLICATE_ADDRESS",
      ],
      [
        "program index 0",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.instructionHeaders, 0),
        "PROGRAM_INDEX",
      ],
      [
        "a trailing byte",
        withTrailingBytes(SPEC_V1_MESSAGE, [0]),
        "TRAILING_BYTES",
      ],
      ["a truncated message", SPEC_V1_MESSAGE.subarray(0, 100), "TRUNCATED"],
      [
        "a message shorter than any legacy message",
        SPEC_V1_MESSAGE.subarray(0, 10),
        "TRUNCATED",
      ],
    ])("returns InvalidV1MessageError for %s", async (_, bytes, rule) => {
      const error = (await parseV1(bytes)).swap().unsafeCoerce();

      expect(error).toBeInstanceOf(InvalidV1MessageError);
      expect(error).toMatchObject({ rule });
    });

    it("returns EmptyInstructionsError for a v1 message without instructions", async () => {
      const bytes = encodeV1Message({ ...SPEC_V1_INPUT, instructions: [] });

      const error = (await parseV1(bytes)).swap().unsafeCoerce();

      expect(error).toBeInstanceOf(EmptyInstructionsError);
    });

    it("never calls the web3.js decoders, which cannot read v1", async () => {
      const spies = [
        vi.spyOn(VersionedTransaction, "deserialize"),
        vi.spyOn(VersionedMessage, "deserialize"),
        vi.spyOn(Transaction, "from"),
      ];

      await parseV1(SPEC_V1_MESSAGE);
      await parseV1(withTrailingBytes(SPEC_V1_MESSAGE, [0]));

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    });

    it("never calls the ALT resolver and keeps no ALT refs", async () => {
      const resolver: AddressLookupTableResolver = { resolve: vi.fn() };

      const { message } = (
        await parseV1(
          SPEC_V1_MESSAGE,
          new TransactionParser(resolver, { preserveAltRefs: true }),
        )
      ).unsafeCoerce();

      expect(resolver.resolve).not.toHaveBeenCalled();
      expect(message.addressLookupRefs).toBeUndefined();
    });
  });
});
