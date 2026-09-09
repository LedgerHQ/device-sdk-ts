import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import {
  type ScenarioOutcome,
  type ScenarioRunReport,
} from "@root/src/domain/models/ScenarioOutcome";
import { type ScenarioRunner } from "@root/src/domain/services/ScenarioRunner";

/**
 * How many emulators one run may burn through. Each attempt builds its own
 * container, so a retry always lands on a fresh pod rather than the one that
 * just failed.
 */
const MAX_ATTEMPTS = 2;

export type RunScenariosOptions = {
  /** How many scenarios may hold an emulator at once. */
  readonly concurrency: number;
  /** Called when a run is about to be attempted again on a fresh emulator. */
  readonly onRetry?: (
    outcome: ScenarioOutcome,
    attempt: number,
    of: number,
  ) => void;
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
        const outcome = await this.attempt(runs[index]!, options);
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

  /**
   * Run one scenario, trying again on a fresh emulator if it failed.
   *
   * The retry lives here rather than inside a signing flow so it covers every
   * action equally, and so each attempt builds its own container — being rid of
   * the previous emulator is the whole point, since the usual reason to retry
   * is that the emulator went away.
   *
   * A genuine failure fails again, so a retry costs time rather than hiding
   * anything; what it buys is that a pod taken away mid-run does not.
   */
  private async attempt(
    run: ScenarioRun,
    options: RunScenariosOptions,
  ): Promise<ScenarioOutcome> {
    let outcome = await this.runner.run(run);

    for (
      let attempt = 2;
      attempt <= MAX_ATTEMPTS && outcome.failures > 0;
      attempt++
    ) {
      options.onRetry?.(outcome, attempt, MAX_ATTEMPTS);
      outcome = await this.runner.run(run);
    }

    return outcome;
  }
}
