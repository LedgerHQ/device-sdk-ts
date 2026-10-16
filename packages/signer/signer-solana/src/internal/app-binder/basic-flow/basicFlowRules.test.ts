import { type ContextModule } from "@ledgerhq/context-module";
import { Left, Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import {
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "@internal/app-binder/constants";

import { type BasicFlowRule } from "./BasicFlowRule";
import {
  mergeRulesById,
  resolveBasicFlowRules,
  SOLANA_BASIC_FLOW_RULES,
} from "./basicFlowRules";

const PROGRAM_IDS = [SYSTEM_PROGRAM_ID, STAKE_PROGRAM_ID];

const calNativeStaking: BasicFlowRule = {
  id: "native-staking",
  required: [
    { programId: STAKE_PROGRAM_ID, discriminators: [new Uint8Array([2])] },
  ],
  allowed: [],
};

const calOther: BasicFlowRule = {
  id: "other-rule",
  required: [{ programId: "Other111111111111111111111111111111111111111" }],
  allowed: [],
};

const contextModuleWith = (
  getSolanaBasicFlowRules?: ContextModule["getSolanaBasicFlowRules"],
) =>
  ({
    getContexts: vi.fn(),
    getSolanaBasicFlowRules,
  }) as unknown as ContextModule;

describe("resolveBasicFlowRules", () => {
  it("uses the bundled default when the context module has no lookup", async () => {
    await expect(
      resolveBasicFlowRules(contextModuleWith(undefined), PROGRAM_IDS),
    ).resolves.toEqual(SOLANA_BASIC_FLOW_RULES);
  });

  it("uses the bundled default when CAL serves no rules", async () => {
    const lookup = vi.fn().mockResolvedValue(Right([]));

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual(SOLANA_BASIC_FLOW_RULES);
    expect(lookup).toHaveBeenCalledWith({ programIds: PROGRAM_IDS });
  });

  it("uses the bundled default when the CAL lookup fails", async () => {
    const lookup = vi.fn().mockResolvedValue(Left(new Error("CAL down")));

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual(SOLANA_BASIC_FLOW_RULES);
  });

  it("uses the bundled default when the CAL lookup throws", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual(SOLANA_BASIC_FLOW_RULES);
  });

  it("lets a CAL rule replace the bundled rule with the same id", async () => {
    const lookup = vi.fn().mockResolvedValue(Right([calNativeStaking]));

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual([calNativeStaking]);
  });

  it("adds CAL rules with a new id next to the bundled default", async () => {
    const lookup = vi.fn().mockResolvedValue(Right([calOther]));

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual([...SOLANA_BASIC_FLOW_RULES, calOther]);
  });
});

describe("mergeRulesById", () => {
  it("keeps the defaults when there are no CAL rules", () => {
    expect(mergeRulesById(SOLANA_BASIC_FLOW_RULES, [])).toEqual(
      SOLANA_BASIC_FLOW_RULES,
    );
  });

  it("replaces by id and appends new ids", () => {
    expect(
      mergeRulesById(SOLANA_BASIC_FLOW_RULES, [calOther, calNativeStaking]),
    ).toEqual([calOther, calNativeStaking]);
  });
});
