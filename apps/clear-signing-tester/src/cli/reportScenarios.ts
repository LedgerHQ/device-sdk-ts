import {
  type ScenarioOutcome,
  type ScenarioRunReport,
} from "@root/src/domain/models/ScenarioOutcome";

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
export function reportScenarios(report: ScenarioRunReport): void {
  console.log("\n📋 SCENARIO RESULTS");
  console.table(
    report.outcomes.map((o) => ({
      Scenario: o.run.scenario.name,
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
      const why = o.errorMessage ?? `${o.failures} case(s) did not clear-sign`;
      console.log(`  ${o.run.scenario.name} @ ${o.run.device}: ${why}`);
    }
  }

  console.log("\n📊 RUN SUMMARY");
  console.table([
    { Metric: "Scenarios", Value: report.outcomes.length },
    { Metric: "Passed", Value: report.outcomes.length - failed.length },
    { Metric: "Failed", Value: failed.length },
    { Metric: "Failing cases", Value: report.failures },
  ]);
}
