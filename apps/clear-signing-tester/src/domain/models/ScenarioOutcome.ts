import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import {
  type FailedCase,
  type StatusCounts,
} from "@root/src/domain/utils/ResultFormatter";

/** What one scenario run produced. */
export type ScenarioOutcome = {
  readonly run: ScenarioRun;
  readonly counts: StatusCounts;
  /** Cases that missed their expected outcome, which the exit code counts. */
  readonly failures: number;
  /** Those cases by name, so the report can say which one failed. */
  readonly failedCases: readonly FailedCase[];
  readonly durationMs: number;
  /** Set when the run could not produce counts at all (no pod, crash, …). */
  readonly errorMessage?: string;
};

/** The whole run, once every scenario has finished. */
export type ScenarioRunReport = {
  readonly outcomes: readonly ScenarioOutcome[];
  readonly failures: number;
};
