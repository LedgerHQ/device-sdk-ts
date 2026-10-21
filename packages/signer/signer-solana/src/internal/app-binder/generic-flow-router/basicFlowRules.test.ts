import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import { describe, expect, it, vi } from "vitest";

import {
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "@internal/app-binder/constants";

import { type BasicFlowRule } from "./BasicFlowRule";
import {
  CAL_RULES_TIMEOUT_MS,
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

const ruleContext = (payload: BasicFlowRule): ClearSignContext => ({
  type: ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
  payload,
});

const contextModuleWith = (getContexts: ContextModule["getContexts"]) =>
  ({ getContexts }) as unknown as ContextModule;

describe("resolveBasicFlowRules", () => {
  it("uses the bundled default when CAL serves no rules", async () => {
    const lookup = vi.fn().mockResolvedValue([]);

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual(SOLANA_BASIC_FLOW_RULES);
    expect(lookup).toHaveBeenCalledWith({ programIds: PROGRAM_IDS }, [
      ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
    ]);
  });

  it("uses the bundled default when the CAL lookup fails", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValue([
        { type: ClearSignContextType.ERROR, error: new Error("CAL down") },
      ]);

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

  it("uses the bundled default when the CAL lookup never settles", async () => {
    vi.useFakeTimers();
    try {
      const lookup = vi.fn().mockReturnValue(new Promise(() => {}));

      const rules = resolveBasicFlowRules(
        contextModuleWith(lookup),
        PROGRAM_IDS,
      );
      await vi.advanceTimersByTimeAsync(CAL_RULES_TIMEOUT_MS);

      await expect(rules).resolves.toEqual(SOLANA_BASIC_FLOW_RULES);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a CAL rule replace the bundled rule with the same id", async () => {
    const lookup = vi.fn().mockResolvedValue([ruleContext(calNativeStaking)]);

    await expect(
      resolveBasicFlowRules(contextModuleWith(lookup), PROGRAM_IDS),
    ).resolves.toEqual([calNativeStaking]);
  });

  it("adds CAL rules with a new id next to the bundled default", async () => {
    const lookup = vi.fn().mockResolvedValue([ruleContext(calOther)]);

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
