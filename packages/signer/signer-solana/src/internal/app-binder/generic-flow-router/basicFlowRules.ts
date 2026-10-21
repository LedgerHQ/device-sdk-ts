import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";

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

// Sends native staking (stake, unstake, withdraw) to the basic flow.
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

// How long to wait for CAL rules before using the bundled default alone.
export const CAL_RULES_TIMEOUT_MS = 3000;

/**
 * Rules used to route a transaction to the basic flow: the bundled default,
 * overridden rule by rule (same id) by whatever CAL serves for the
 * transaction's programs. A CAL failure or timeout, or a context module
 * that doesn't load these rules, means no CAL rules, so the bundled default
 * still applies.
 */
export async function resolveBasicFlowRules(
  contextModule: ContextModule,
  programIds: string[],
): Promise<ReadonlyArray<BasicFlowRule>> {
  const calRules = await fetchCalRules(contextModule, programIds);
  return mergeRulesById(SOLANA_BASIC_FLOW_RULES, calRules);
}

async function fetchCalRules(
  contextModule: ContextModule,
  programIds: string[],
): Promise<ReadonlyArray<BasicFlowRule>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ReadonlyArray<BasicFlowRule>>((resolve) => {
    timer = setTimeout(() => resolve([]), CAL_RULES_TIMEOUT_MS);
  });
  const lookup = Promise.resolve()
    .then(() =>
      contextModule.getContexts({ programIds }, [
        ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
      ]),
    )
    .then((contexts) =>
      contexts.flatMap((context) =>
        context.type === ClearSignContextType.SOLANA_BASIC_FLOW_RULE
          ? [context.payload]
          : [],
      ),
    )
    .catch(() => []);
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** CAL rules replace the bundled rule with the same id; new ids are added. */
export function mergeRulesById(
  defaults: ReadonlyArray<BasicFlowRule>,
  calRules: ReadonlyArray<BasicFlowRule>,
): BasicFlowRule[] {
  const calIds = new Set(calRules.map((rule) => rule.id));
  return [...defaults.filter((rule) => !calIds.has(rule.id)), ...calRules];
}
