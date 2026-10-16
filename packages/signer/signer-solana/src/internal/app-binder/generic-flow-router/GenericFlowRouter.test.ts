import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  COMPUTE_BUDGET_PROGRAM_ID,
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "@internal/app-binder/constants";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import { type NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";
import {
  type ParsedTransaction,
  TransactionParser,
} from "@internal/app-binder/services/utils/TransactionParser";

import { type BasicFlowRule } from "./BasicFlowRule";
import { SOLANA_BASIC_FLOW_RULES } from "./basicFlowRules";
import { GenericFlowRouter } from "./GenericFlowRouter";

const BLOCKHASH = DefaultBs58Encoder.encode(new Uint8Array(32).fill(0xaa));
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

const payer = Keypair.generate().publicKey;
const stakeAccount = Keypair.generate().publicKey;

// Native programs encode the instruction index as u32 LE, followed by args.
const u32le = (index: number) => [index & 0xff, (index >> 8) & 0xff, 0, 0];

function ix(
  programId: string,
  data: number[],
  account: PublicKey = stakeAccount,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(programId),
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: account, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
}

const computeUnitLimit = () =>
  ComputeBudgetProgram.setComputeUnitLimit({ units: 12_000 });
const createAccountWithSeed = () =>
  ix(SYSTEM_PROGRAM_ID, [...u32le(3), 0xaa, 0xbb]);
const transfer = () => ix(SYSTEM_PROGRAM_ID, [...u32le(2), 1, 0, 0, 0]);
const stake = (index: number) => ix(STAKE_PROGRAM_ID, [...u32le(index), 0xcc]);
const memo = () => ix(MEMO_PROGRAM_ID, [0x68, 0x69]);

async function parse(bytes: Uint8Array): Promise<ParsedTransaction> {
  const parsed = await new TransactionParser().parse(bytes).run();
  return parsed.unsafeCoerce();
}

function legacyMessage(
  instructions: TransactionInstruction[],
): Promise<ParsedTransaction> {
  return parse(
    new TransactionMessage({
      payerKey: payer,
      recentBlockhash: BLOCKHASH,
      instructions,
    })
      .compileToLegacyMessage()
      .serialize(),
  );
}

const defaultRouter = new GenericFlowRouter(SOLANA_BASIC_FLOW_RULES, {
  leadingAllowed: [COMPUTE_BUDGET_PROGRAM_ID],
});

describe("GenericFlowRouter", () => {
  describe("bundled native-staking rule", () => {
    it("matches a Ledger Wallet stake transaction", async () => {
      const message = await legacyMessage([
        computeUnitLimit(),
        createAccountWithSeed(),
        stake(0), // Initialize
        stake(2), // DelegateStake
      ]);
      expect(defaultRouter.match(message)).toBe("native-staking");
    });

    it("matches a Deactivate alone", async () => {
      const message = await legacyMessage([computeUnitLimit(), stake(5)]);
      expect(defaultRouter.match(message)).toBe("native-staking");
    });

    it("matches a Withdraw alone", async () => {
      const message = await legacyMessage([stake(4)]);
      expect(defaultRouter.match(message)).toBe("native-staking");
    });

    it.each([
      ["Split", 3],
      ["MoveStake", 16],
    ])("does not match Stake::%s", async (_name, index) => {
      const message = await legacyMessage([computeUnitLimit(), stake(index)]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("does not match when only allowed instructions are present", async () => {
      const message = await legacyMessage([createAccountWithSeed(), stake(0)]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("does not match DelegateStake + System::Transfer", async () => {
      const message = await legacyMessage([stake(2), transfer()]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("does not match a System::Transfer only", async () => {
      const message = await legacyMessage([computeUnitLimit(), transfer()]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("does not match a stake transaction with a Memo", async () => {
      const message = await legacyMessage([
        createAccountWithSeed(),
        stake(0),
        stake(2),
        memo(),
      ]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("does not match a ComputeBudget-only transaction", async () => {
      const message = await legacyMessage([computeUnitLimit()]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("does not match ComputeBudget when it is not leading-allowed", async () => {
      const message = await legacyMessage([computeUnitLimit(), stake(5)]);
      expect(
        new GenericFlowRouter(SOLANA_BASIC_FLOW_RULES).match(message),
      ).toBe(null);
    });

    // The app's basic flow displays one staking operation per transaction.
    it.each([
      ["two Deactivates", [stake(5), stake(5)]],
      ["Deactivate + Withdraw", [stake(5), stake(4)]],
      ["DelegateStake + Withdraw", [stake(2), stake(4)]],
    ])("does not match %s", async (_name, instructions) => {
      const message = await legacyMessage([
        computeUnitLimit(),
        ...instructions,
      ]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    // The app only strips ComputeBudget from the start of the message.
    it("matches several leading ComputeBudget instructions", async () => {
      const message = await legacyMessage([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        computeUnitLimit(),
        stake(4),
      ]);
      expect(defaultRouter.match(message)).toBe("native-staking");
    });

    it("does not match ComputeBudget after a stake instruction", async () => {
      const message = await legacyMessage([stake(4), computeUnitLimit()]);
      expect(defaultRouter.match(message)).toBeNull();
    });

    it("matches a v0 message without address lookup tables", async () => {
      const bytes = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: BLOCKHASH,
        instructions: [computeUnitLimit(), stake(5)],
      })
        .compileToV0Message()
        .serialize();
      expect(defaultRouter.match(await parse(bytes))).toBe("native-staking");
    });

    // The app's basic flow can't read accounts loaded from a lookup table.
    it("does not match a v0 message using an address lookup table", async () => {
      const altAccount = Keypair.generate().publicKey;
      const lookupTable = new AddressLookupTableAccount({
        key: Keypair.generate().publicKey,
        state: {
          deactivationSlot: BigInt("18446744073709551615"),
          lastExtendedSlot: 0,
          lastExtendedSlotStartIndex: 0,
          authority: payer,
          addresses: [altAccount],
        },
      });
      const bytes = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: BLOCKHASH,
        instructions: [
          computeUnitLimit(),
          ix(STAKE_PROGRAM_ID, u32le(5), altAccount),
        ],
      })
        .compileToV0Message([lookupTable])
        .serialize();

      // Program IDs are static keys: no ALT resolver is needed.
      const parsed = await new TransactionParser().parse(bytes).run();
      expect(parsed.unsafeCoerce().usesAddressLookupTables).toBe(true);
      expect(defaultRouter.match(parsed.unsafeCoerce())).toBeNull();
    });
  });

  describe("matching semantics", () => {
    it("matches any instruction of a program when an entry has no discriminators", async () => {
      const router = new GenericFlowRouter([
        {
          id: "any-memo",
          required: [{ programId: MEMO_PROGRAM_ID }],
          allowed: [],
        },
      ]);
      expect(router.match(await legacyMessage([memo()]))).toBe("any-memo");
      expect(router.match(await legacyMessage([ix(MEMO_PROGRAM_ID, [])]))).toBe(
        "any-memo",
      );
    });

    it("matches discriminators by prefix and not when data is shorter", async () => {
      const router = new GenericFlowRouter([
        {
          id: "anchor",
          required: [
            {
              programId: MEMO_PROGRAM_ID,
              discriminators: [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])],
            },
          ],
          allowed: [],
        },
      ]);
      const longer = await legacyMessage([
        ix(MEMO_PROGRAM_ID, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      ]);
      const shorter = await legacyMessage([
        ix(MEMO_PROGRAM_ID, [1, 2, 3, 4, 5, 6, 7]),
      ]);
      expect(router.match(longer)).toBe("anchor");
      expect(router.match(shorter)).toBeNull();
    });

    it("returns the id of the first matching rule", async () => {
      const rules: BasicFlowRule[] = [
        {
          id: "no-match",
          required: [{ programId: MEMO_PROGRAM_ID }],
          allowed: [],
        },
        {
          id: "first",
          required: [{ programId: STAKE_PROGRAM_ID }],
          allowed: [],
        },
        ...SOLANA_BASIC_FLOW_RULES,
      ];
      const message = await legacyMessage([stake(5)]);
      expect(new GenericFlowRouter(rules).match(message)).toBe("first");
    });

    it("returns null when there are no rules", async () => {
      const message = await legacyMessage([stake(5)]);
      expect(new GenericFlowRouter([]).match(message)).toBeNull();
    });

    it("returns null when a program key is missing", () => {
      const message: NormalizedMessage = {
        allKeys: [payer],
        compiledInstructions: [
          {
            programIdIndex: 3,
            accountKeyIndexes: [0],
            accountWritable: [true],
            accountSigner: [true],
            data: new Uint8Array(u32le(5)),
          },
        ],
      };
      expect(
        defaultRouter.match({ message, usesAddressLookupTables: false }),
      ).toBeNull();
    });
  });
});
