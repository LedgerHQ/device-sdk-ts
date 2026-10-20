import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type InstructionInfoDataSource,
  type InstructionInfoResult,
  type SolanaBasicFlowTag,
  SolanaProgramNotFoundError,
} from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import { type SolanaBasicFlowRule } from "@/modules/solana/model/SolanaContextTypes";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

import { SolanaBasicFlowRuleContextLoader } from "./SolanaBasicFlowRuleContextLoader";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const mockLoggerFactory = () => mockLogger;

const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

const u32le = (n: number) => new Uint8Array([n, 0, 0, 0]);

function makeResult(
  programId: string,
  basicFlowTags: SolanaBasicFlowTag[] = [],
): InstructionInfoResult {
  return { programId, descriptors: {}, enumVariants: [], basicFlowTags };
}

// What CAL will serve once the registry annotates native staking.
const stakeResult = makeResult(STAKE_PROGRAM, [
  { discriminator: "00000000", rule: "native-staking", role: "allowed" },
  { discriminator: "02000000", rule: "native-staking", role: "required" },
  { discriminator: "04000000", rule: "native-staking", role: "required" },
  { discriminator: "05000000", rule: "native-staking", role: "required" },
]);
const systemResult = makeResult(SYSTEM_PROGRAM, [
  { discriminator: "03000000", rule: "native-staking", role: "allowed" },
]);

const notFound = (programId: string) =>
  Left(new SolanaProgramNotFoundError(programId, `not found ${programId}`));

const rulesOf = (contexts: ClearSignContext[]): SolanaBasicFlowRule[] =>
  contexts.flatMap((context) =>
    context.type === ClearSignContextType.SOLANA_BASIC_FLOW_RULE
      ? [context.payload]
      : [],
  );

describe("SolanaBasicFlowRuleContextLoader", () => {
  let dataSource: InstructionInfoDataSource;
  let byProgram: Record<
    string,
    Awaited<ReturnType<InstructionInfoDataSource["getInstructionInfo"]>>
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    byProgram = {};
    dataSource = {
      getInstructionInfo: vi.fn(({ programId }: { programId: string }) =>
        Promise.resolve(byProgram[programId] ?? notFound(programId)),
      ),
    };
  });

  const makeLoader = () =>
    new SolanaBasicFlowRuleContextLoader(dataSource, mockLoggerFactory);

  describe("canHandle", () => {
    const expectedTypes = [ClearSignContextType.SOLANA_BASIC_FLOW_RULE];

    it("accepts program ids with an optional network", () => {
      const loader = makeLoader();
      expect(loader.canHandle({ programIds: [] }, expectedTypes)).toBe(true);
      expect(
        loader.canHandle(
          { programIds: [STAKE_PROGRAM], network: "solana-devnet" },
          expectedTypes,
        ),
      ).toBe(true);
    });

    it("rejects other inputs", () => {
      const loader = makeLoader();
      expect(loader.canHandle(undefined, expectedTypes)).toBe(false);
      expect(loader.canHandle({ programIds: [1] }, expectedTypes)).toBe(false);
    });

    it("rejects when basic-flow rules are not expected", () => {
      expect(
        makeLoader().canHandle({ programIds: [STAKE_PROGRAM] }, [
          ClearSignContextType.SOLANA_INSTRUCTION_INFO,
        ]),
      ).toBe(false);
    });
  });

  it("rebuilds one rule from tags spread across two programs", async () => {
    byProgram[STAKE_PROGRAM] = Right(stakeResult);
    byProgram[SYSTEM_PROGRAM] = Right(systemResult);

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, SYSTEM_PROGRAM],
      network: "solana-mainnet",
    });

    // One matcher per (program, role), same shape as the bundled default.
    expect(result).toEqual([
      {
        type: ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
        payload: {
          id: "native-staking",
          required: [
            {
              programId: STAKE_PROGRAM,
              discriminators: [u32le(2), u32le(4), u32le(5)],
            },
          ],
          allowed: [
            { programId: STAKE_PROGRAM, discriminators: [u32le(0)] },
            { programId: SYSTEM_PROGRAM, discriminators: [u32le(3)] },
          ],
        },
      },
    ]);
  });

  it("builds one rule per rule id", async () => {
    byProgram[STAKE_PROGRAM] = Right(
      makeResult(STAKE_PROGRAM, [
        { discriminator: "02000000", rule: "native-staking", role: "required" },
        { discriminator: "02000000", rule: "foo", role: "required" },
      ]),
    );

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM],
      network: "solana-mainnet",
    });

    expect(rulesOf(result).map(({ id }) => id)).toEqual([
      "native-staking",
      "foo",
    ]);
  });

  it("returns no contexts when no program carries tags", async () => {
    byProgram[STAKE_PROGRAM] = Right(makeResult(STAKE_PROGRAM));
    byProgram[SYSTEM_PROGRAM] = Right(makeResult(SYSTEM_PROGRAM));

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, SYSTEM_PROGRAM],
      network: "solana-mainnet",
    });

    expect(result).toEqual([]);
  });

  it("treats a program not in CAL as having no tags", async () => {
    byProgram[STAKE_PROGRAM] = Right(stakeResult);

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, MEMO_PROGRAM],
      network: "solana-mainnet",
    });

    expect(rulesOf(result)).toEqual([
      expect.objectContaining({
        id: "native-staking",
        allowed: [{ programId: STAKE_PROGRAM, discriminators: [u32le(0)] }],
      }),
    ]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[load] Program not in CAL, no signing route",
      { data: { programId: MEMO_PROGRAM } },
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("returns an error context when a CAL lookup fails", async () => {
    const error = new Error("network");
    byProgram[STAKE_PROGRAM] = Right(stakeResult);
    byProgram[SYSTEM_PROGRAM] = Left(error);

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, SYSTEM_PROGRAM],
      network: "solana-mainnet",
    });

    expect(result).toEqual([{ type: ClearSignContextType.ERROR, error }]);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[load] Failed to fetch signing routes from CAL",
      { data: { programId: SYSTEM_PROGRAM, error: "network" } },
    );
  });

  it("skips a tag whose discriminator is not valid hex", async () => {
    byProgram[STAKE_PROGRAM] = Right(
      makeResult(STAKE_PROGRAM, [
        { discriminator: "zz", rule: "native-staking", role: "required" },
        { discriminator: "02000000", rule: "native-staking", role: "required" },
      ]),
    );

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM],
      network: "solana-mainnet",
    });

    expect(rulesOf(result)[0]!.required).toEqual([
      { programId: STAKE_PROGRAM, discriminators: [u32le(2)] },
    ]);
  });

  it("fetches each distinct program once, on mainnet by default", async () => {
    byProgram[STAKE_PROGRAM] = Right(stakeResult);

    await makeLoader().load({ programIds: [STAKE_PROGRAM, STAKE_PROGRAM] });

    expect(dataSource.getInstructionInfo).toHaveBeenCalledTimes(1);
    expect(dataSource.getInstructionInfo).toHaveBeenCalledWith({
      programId: STAKE_PROGRAM,
      network: "solana-mainnet",
    });
  });

  it("forwards the network to the data source", async () => {
    await makeLoader().load({
      programIds: [STAKE_PROGRAM],
      network: "solana-devnet",
    });

    expect(dataSource.getInstructionInfo).toHaveBeenCalledWith({
      programId: STAKE_PROGRAM,
      network: "solana-devnet",
    });
  });
});
