import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type InstructionInfoDataSource,
  type InstructionInfoResult,
  type SolanaBasicFlowTag,
  SolanaProgramNotFoundError,
} from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";

import { SolanaBasicFlowRulesLoader } from "./SolanaBasicFlowRulesLoader";

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

describe("SolanaBasicFlowRulesLoader", () => {
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
    new SolanaBasicFlowRulesLoader(dataSource, mockLoggerFactory);

  it("rebuilds one rule from tags spread across two programs", async () => {
    byProgram[STAKE_PROGRAM] = Right(stakeResult);
    byProgram[SYSTEM_PROGRAM] = Right(systemResult);

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, SYSTEM_PROGRAM],
      network: "solana-mainnet",
    });

    // One matcher per (program, role), same shape as the bundled default.
    expect(result).toEqual(
      Right([
        {
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
      ]),
    );
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

    expect(result.unsafeCoerce().map(({ id }) => id)).toEqual([
      "native-staking",
      "foo",
    ]);
  });

  it("returns Right([]) when no program carries tags", async () => {
    byProgram[STAKE_PROGRAM] = Right(makeResult(STAKE_PROGRAM));
    byProgram[SYSTEM_PROGRAM] = Right(makeResult(SYSTEM_PROGRAM));

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, SYSTEM_PROGRAM],
      network: "solana-mainnet",
    });

    expect(result).toEqual(Right([]));
  });

  it("treats a program not in CAL as having no tags", async () => {
    byProgram[STAKE_PROGRAM] = Right(stakeResult);

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, MEMO_PROGRAM],
      network: "solana-mainnet",
    });

    expect(result.isRight()).toBe(true);
    expect(result.unsafeCoerce()).toEqual([
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

  it("returns Left when a CAL lookup fails", async () => {
    const error = new Error("network");
    byProgram[STAKE_PROGRAM] = Right(stakeResult);
    byProgram[SYSTEM_PROGRAM] = Left(error);

    const result = await makeLoader().load({
      programIds: [STAKE_PROGRAM, SYSTEM_PROGRAM],
      network: "solana-mainnet",
    });

    expect(result).toEqual(Left(error));
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

    expect(result.unsafeCoerce()[0]!.required).toEqual([
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
