import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import { type ScenarioOutcome } from "@root/src/domain/models/ScenarioOutcome";

/**
 * Runs one scenario against its own emulator.
 *
 * Kept behind a port so the orchestration above it — selection, concurrency,
 * aggregation — needs no container, and can be tested without an emulator.
 */
export interface ScenarioRunner {
  run(run: ScenarioRun): Promise<ScenarioOutcome>;
}
