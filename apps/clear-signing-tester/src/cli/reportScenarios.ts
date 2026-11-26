import {
  type CalBranch,
  type CalMode,
} from "@root/src/domain/models/config/CalConfig";
import {
  type ScenarioOutcome,
  type ScenarioRunReport,
} from "@root/src/domain/models/ScenarioOutcome";
import { ResultFormatter } from "@root/src/domain/utils/ResultFormatter";

/** The CAL snapshot a run read, so its results can be traced back to it. */
export type CalRun = {
  readonly branch: CalBranch;
  readonly mode: CalMode;
  /**
   * The crypto-assets commit CAL served, read once at startup on a branch
   * other than `main`. Absent on `main`, or when it could not be read.
   */
  readonly commit?: string;
};

/** One line for the run header, e.g. `CAL next @ 1a2b3c…, test mode`. */
export function describeCal(cal: CalRun): string {
  const commit =
    cal.branch === "main" ? "" : ` @ ${cal.commit ?? "unknown commit"}`;
  return `CAL ${cal.branch}${commit}, ${cal.mode} mode`;
}

const seconds = (ms: number): string => `${Math.round(ms / 1000)}s`;

const verdict = (outcome: ScenarioOutcome): string => {
  if (outcome.errorMessage) return "💥 did not run";
  return outcome.failures === 0 ? "✅ passed" : "❌ failed";
};

/**
 * Print one table for the whole run.
 *
 * A run spreads over many emulators, so its per-scenario logs interleave; the
 * table is what makes the outcome readable afterwards.
 */
export function reportScenarios(report: ScenarioRunReport, cal: CalRun): void {
  console.log("\n📋 SCENARIO RESULTS");
  console.table(
    report.outcomes.map((o) => ({
      Scenario: o.run.scenario.name,
      Case: o.run.slice ? `${o.run.slice.index}/${o.run.slice.count}` : "all",
      Device: o.run.device,
      Verdict: verdict(o),
      Clear: o.counts.clearSigned,
      Partial: o.counts.partiallyClearSigned,
      Blind: o.counts.blindSigned,
      Errors: o.counts.error,
      Took: seconds(o.durationMs),
    })),
  );

  const failed = report.outcomes.filter((o) => o.failures > 0);
  if (failed.length > 0) {
    console.log("\n❌ FAILED SCENARIOS");
    for (const o of failed) {
      console.log(`  ${o.run.scenario.name} @ ${o.run.device}`);
      if (o.errorMessage) {
        console.log(`    did not run: ${o.errorMessage}`);
        continue;
      }
      // Name the cases: with the run spread over many emulators, the scenario
      // alone does not say which input actually failed.
      for (const c of o.failedCases) {
        const detail = c.errorMessage ? `: ${c.errorMessage}` : "";
        const hash = c.hash ? ` (${c.hash})` : "";
        console.log(
          `    ${ResultFormatter.getStatusEmoji(c.status)} ${c.description}${hash}` +
            ` — ${c.status.replace(/_/g, " ")}${detail}`,
        );
      }
      // A case that never produced a result is counted but cannot be named.
      const unnamed = o.failures - o.failedCases.length;
      if (unnamed > 0) console.log(`    ${unnamed} case(s) produced no result`);
    }
  }

  console.log("\n📊 RUN SUMMARY");
  console.table([
    { Metric: "Scenarios", Value: report.outcomes.length },
    { Metric: "Passed", Value: report.outcomes.length - failed.length },
    { Metric: "Failed", Value: failed.length },
    { Metric: "Failing cases", Value: report.failures },
    // The summary is what a CI job keeps, so it names the CAL it ran against.
    { Metric: "CAL branch", Value: cal.branch },
    { Metric: "CAL mode", Value: cal.mode },
    ...(cal.branch === "main"
      ? []
      : [{ Metric: "CAL commit", Value: cal.commit ?? "unknown" }]),
  ]);
}
