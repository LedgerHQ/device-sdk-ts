import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import { type StatusCounts } from "@root/src/domain/utils/ResultFormatter";

/** What one scenario run produced. */
export type ScenarioOutcome = {
  readonly run: ScenarioRun;
  readonly counts: StatusCounts;
  /** Cases that did not clear-sign, which is what the exit code counts. */
  readonly failures: number;
  readonly durationMs: number;
  /** Set when the run could not produce counts at all (no pod, crash, …). */
  readonly errorMessage?: string;
};

/** The whole run, once every scenario has finished. */
export type ScenarioRunReport = {
  readonly outcomes: readonly ScenarioOutcome[];
  readonly failures: number;
};
