import { type ScenarioRun } from "@root/src/domain/models/Scenario";

/** How many cases each fixture holds, keyed by scenario name. */
export type CaseCounts = Readonly<Record<string, number>>;

/**
 * Split each run into one run per case, so every case can take its own emulator.
 *
 * A case is the real unit of work: a fixture of eighteen transactions is
 * eighteen independent tests, and running them on one device serialises what
 * could be parallel. Scenarios whose cases depend on each other, and those
 * whose case count is unknown until they run, stay whole.
 *
 * @param runs - Scenario runs, as planned from the selectors
 * @param caseCounts - Case count per scenario name; a missing entry stays whole
 */
export function expandToCases(
  runs: readonly ScenarioRun[],
  caseCounts: CaseCounts,
): readonly ScenarioRun[] {
  return runs.flatMap((run) => {
    const count = caseCounts[run.scenario.name];
    if (run.scenario.sequential || count === undefined || count <= 1) {
      return [run];
    }
    return Array.from({ length: count }, (_, index) => ({
      ...run,
      slice: { index: index + 1, count },
    }));
  });
}
