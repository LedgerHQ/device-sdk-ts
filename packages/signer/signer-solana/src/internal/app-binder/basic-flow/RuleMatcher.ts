import { type NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";

import { type BasicFlowRule, type InstructionMatcher } from "./BasicFlowRule";

export type RuleMatcherOptions = {
  /**
   * Programs ignored by every rule (e.g. ComputeBudget): their instructions
   * neither satisfy `required` nor need to be covered by `allowed`.
   */
  alwaysAllowed?: ReadonlyArray<string>;
};

type MatchableInstruction = { programId: string; data: Uint8Array };

/**
 * Pure matcher deciding whether a message goes to the basic flow.
 * Instruction order is ignored on purpose.
 */
export class RuleMatcher {
  private readonly alwaysAllowed: ReadonlySet<string>;

  constructor(
    private readonly rules: ReadonlyArray<BasicFlowRule>,
    options?: RuleMatcherOptions,
  ) {
    this.alwaysAllowed = new Set(options?.alwaysAllowed ?? []);
  }

  /** Returns the id of the first matching rule, or `null` when none matches. */
  match(message: NormalizedMessage): string | null {
    const instructions: MatchableInstruction[] = [];
    for (const ix of message.compiledInstructions) {
      const programId = message.allKeys[ix.programIdIndex]?.toBase58();
      if (programId === undefined) return null;
      if (this.alwaysAllowed.has(programId)) continue;
      instructions.push({ programId, data: ix.data });
    }

    for (const rule of this.rules) {
      const hasRequired = instructions.some((ix) =>
        rule.required.some((matcher) => matches(matcher, ix)),
      );
      const allCovered = instructions.every(
        (ix) =>
          rule.required.some((matcher) => matches(matcher, ix)) ||
          rule.allowed.some((matcher) => matches(matcher, ix)),
      );
      if (hasRequired && allCovered) return rule.id;
    }
    return null;
  }
}

function matches(
  matcher: InstructionMatcher,
  ix: MatchableInstruction,
): boolean {
  return (
    matcher.programId === ix.programId &&
    (matcher.discriminators === undefined ||
      matcher.discriminators.some((discriminator) =>
        startsWith(ix.data, discriminator),
      ))
  );
}

function startsWith(data: Uint8Array, prefix: Uint8Array): boolean {
  return (
    data.length >= prefix.length &&
    prefix.every((byte, index) => data[index] === byte)
  );
}
