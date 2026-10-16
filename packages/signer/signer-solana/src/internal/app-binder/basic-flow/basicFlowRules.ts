import { type ContextModule } from "@ledgerhq/context-module";

import {
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "@internal/app-binder/constants";

import { type BasicFlowRule } from "./BasicFlowRule";

// Native programs encode the instruction index as u32 LE.
const u32le = (index: number) =>
  new Uint8Array([
    index & 0xff,
    (index >> 8) & 0xff,
    (index >> 16) & 0xff,
    (index >> 24) & 0xff,
  ]);

// TODO: temporary. Remove once the generic merge engine / the Solana app
// clear-sign native staking (stake, unstake, withdraw) properly.
export const SOLANA_BASIC_FLOW_RULES: ReadonlyArray<BasicFlowRule> = [
  {
    id: "native-staking",
    required: [
      {
        programId: STAKE_PROGRAM_ID,
        discriminators: [
          u32le(2), // DelegateStake
          u32le(5), // Deactivate
          u32le(4), // Withdraw
        ],
      },
    ],
    allowed: [
      { programId: STAKE_PROGRAM_ID, discriminators: [u32le(0)] }, // Initialize
      { programId: SYSTEM_PROGRAM_ID, discriminators: [u32le(3)] }, // CreateAccountWithSeed
    ],
  },
];

/**
 * Rules used to route a transaction to the basic flow: the bundled default,
 * overridden rule by rule (same id) by whatever CAL serves for the
 * transaction's programs. A CAL failure, or a context module without the
 * lookup, means no CAL rules, so the bundled default still applies.
 */
export async function resolveBasicFlowRules(
  contextModule: ContextModule,
  programIds: string[],
): Promise<ReadonlyArray<BasicFlowRule>> {
  let calRules: ReadonlyArray<BasicFlowRule> = [];
  try {
    const result = await contextModule.getSolanaBasicFlowRules?.({
      programIds,
    });
    calRules = result?.orDefault([]) ?? [];
  } catch {
    // Same as no CAL rules.
  }
  return mergeRulesById(SOLANA_BASIC_FLOW_RULES, calRules);
}

/** CAL rules replace the bundled rule with the same id; new ids are added. */
export function mergeRulesById(
  defaults: ReadonlyArray<BasicFlowRule>,
  calRules: ReadonlyArray<BasicFlowRule>,
): BasicFlowRule[] {
  const calIds = new Set(calRules.map((rule) => rule.id));
  return [...defaults.filter((rule) => !calIds.has(rule.id)), ...calRules];
}
