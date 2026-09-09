import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import {
  type ScenarioOutcome,
  type ScenarioRunReport,
} from "@root/src/domain/models/ScenarioOutcome";
import { type ScenarioRunner } from "@root/src/domain/services/ScenarioRunner";

export type RunScenariosOptions = {
  /** How many scenarios may hold an emulator at once. */
  readonly concurrency: number;
  /** Called as each scenario finishes, so a long run reports as it goes. */
  readonly onOutcome?: (
    outcome: ScenarioOutcome,
    done: number,
    total: number,
  ) => void;
};

/**
 * Run a set of scenarios, at most `concurrency` at a time.
 *
 * Each scenario gets its own emulator, so they are independent and the run
 * costs about as much wall clock as the slowest bucket rather than the sum.
 * Outcomes come back in the input order regardless of completion order, so a
 * report reads the same however the pool interleaved.
 */
export class RunScenariosUseCase {
  constructor(private readonly runner: ScenarioRunner) {}

  async execute(
    runs: readonly ScenarioRun[],
    options: RunScenariosOptions,
  ): Promise<ScenarioRunReport> {
    const outcomes = new Array<ScenarioOutcome>(runs.length);
    const workers = Math.max(1, Math.min(options.concurrency, runs.length));
    let next = 0;
    let done = 0;

    const work = async (): Promise<void> => {
      for (;;) {
        const index = next++;
        if (index >= runs.length) return;
        const outcome = await this.runner.run(runs[index]!);
        outcomes[index] = outcome;
        done += 1;
        options.onOutcome?.(outcome, done, runs.length);
      }
    };

    await Promise.all(Array.from({ length: workers }, work));

    return {
      outcomes,
      failures: outcomes.reduce((sum, o) => sum + o.failures, 0),
    };
  }
}
