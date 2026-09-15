import { readFileSync } from "fs";

import { type Scenario } from "@root/src/domain/models/Scenario";

/**
 * How many cases a scenario's fixture holds.
 *
 * Returns undefined when the count cannot be known before running: a scenario
 * with no fixture (a Solana program pulls its transactions from the RPC), or a
 * file carrying no `cases` list.
 */
export function countFixtureCases(scenario: Scenario): number | undefined {
  if (!scenario.fixture) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(scenario.fixture, "utf-8"));
    const cases =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { cases?: unknown }).cases
        : undefined;
    return Array.isArray(cases) ? cases.length : undefined;
  } catch {
    // A missing or unreadable fixture is the run's problem to report, not the
    // planner's: leaving it whole lets it fail with the real error.
    return undefined;
  }
}

/** Case counts for every scenario that has a countable fixture. */
export function countCases(
  scenarios: readonly Scenario[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const scenario of scenarios) {
    const count = countFixtureCases(scenario);
    if (count !== undefined) counts[scenario.name] = count;
  }
  return counts;
}
