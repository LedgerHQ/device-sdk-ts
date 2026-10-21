import { type ParsedTransaction } from "@internal/app-binder/services/utils/TransactionParser";

import { type BasicFlowRule, type InstructionMatcher } from "./BasicFlowRule";

export type GenericFlowRouterOptions = {
  /**
   * Programs skipped at the start of the message (e.g. ComputeBudget): those
   * leading instructions neither satisfy `required` nor need to be covered by
   * `allowed`. Anywhere else they are matched like any other instruction.
   */
  leadingAllowed?: ReadonlyArray<string>;
};

type MatchableInstruction = { programId: string; data: Uint8Array };

/**
 * Pure router deciding whether a transaction goes to the basic flow instead
 * of generic clear signing.
 *
 * Only shapes the basic flow can display match: no address lookup tables,
 * leading-allowed programs only before the other instructions, and exactly
 * one instruction matching `required`.
 */
export class GenericFlowRouter {
  private readonly leadingAllowed: ReadonlySet<string>;

  constructor(
    private readonly rules: ReadonlyArray<BasicFlowRule>,
    options?: GenericFlowRouterOptions,
  ) {
    this.leadingAllowed = new Set(options?.leadingAllowed ?? []);
  }

  /** Returns the id of the first matching rule, or `null` when none matches. */
  match({
    message,
    usesAddressLookupTables,
  }: ParsedTransaction): string | null {
    // The basic flow can't read accounts loaded from a lookup table.
    if (usesAddressLookupTables) return null;

    const instructions: MatchableInstruction[] = [];
    for (const ix of message.compiledInstructions) {
      const programId = message.allKeys[ix.programIdIndex]?.toBase58();
      if (programId === undefined) return null;
      if (instructions.length === 0 && this.leadingAllowed.has(programId)) {
        continue;
      }
      instructions.push({ programId, data: ix.data });
    }

    for (const rule of this.rules) {
      const requiredCount = instructions.filter((ix) =>
        rule.required.some((matcher) => matches(matcher, ix)),
      ).length;
      const allCovered = instructions.every(
        (ix) =>
          rule.required.some((matcher) => matches(matcher, ix)) ||
          rule.allowed.some((matcher) => matches(matcher, ix)),
      );
      if (requiredCount === 1 && allCovered) return rule.id;
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
