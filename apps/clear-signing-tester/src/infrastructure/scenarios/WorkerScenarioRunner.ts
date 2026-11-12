import path from "path";
import { Worker } from "worker_threads";

import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import { type ScenarioOutcome } from "@root/src/domain/models/ScenarioOutcome";
import { type ScenarioRunner } from "@root/src/domain/services/ScenarioRunner";
import { type ScenarioRuntime } from "@root/src/infrastructure/scenarios/ContainerScenarioRunner";

export type ScenarioWorkerData = {
  readonly run: ScenarioRun;
  readonly runtime: ScenarioRuntime;
};

export type ScenarioWorkerMessage =
  | { readonly type: "outcome"; readonly outcome: ScenarioOutcome }
  | { readonly type: "released"; readonly count: number };

// Same extension as this file, so it works under tsx (.ts) and once built (.js).
const WORKER_PATH = path.join(
  __dirname,
  `scenarioWorker${path.extname(__filename)}`,
);

// Under tsx, a worker given a .ts path is resolved as ESM, which ignores the
// tsconfig path aliases. Loading it through tsx's CommonJS hook, like the CLI
// itself, keeps them working.
const startWorker = (workerData: ScenarioWorkerData): Worker =>
  path.extname(__filename) === ".ts"
    ? new Worker(
        `require(${JSON.stringify(require.resolve("tsx/cjs"))});` +
          `require(${JSON.stringify(WORKER_PATH)});`,
        { eval: true, workerData },
      )
    : new Worker(WORKER_PATH, { workerData });

const EXIT_GRACE_MS = 5_000;

const failed = (
  run: ScenarioRun,
  startedAt: number,
  errorMessage: string,
): ScenarioOutcome => ({
  run,
  counts: { clearSigned: 0, partiallyClearSigned: 0, blindSigned: 0, error: 0 },
  // A scenario that never ran counts as one failure, as in ContainerScenarioRunner.
  failures: 1,
  failedCases: [],
  durationMs: Date.now() - startedAt,
  errorMessage,
});

/**
 * Runs each scenario in its own worker thread.
 *
 * A worker has its own globals, so each run gets its own DMK logger
 * subscribers (and its own log file) and its own patched fetch for the CAL
 * interceptor, even when runs overlap.
 */
export class WorkerScenarioRunner implements ScenarioRunner {
  private readonly active = new Set<Worker>();
  private cancelled = false;

  constructor(private readonly runtime: ScenarioRuntime) {}

  run(run: ScenarioRun): Promise<ScenarioOutcome> {
    const startedAt = Date.now();
    if (this.cancelled) {
      return Promise.resolve(
        failed(run, startedAt, "cancelled before it started"),
      );
    }

    const worker = startWorker({ run, runtime: this.runtime });
    this.active.add(worker);

    return new Promise((resolve) => {
      worker.on("message", (message: ScenarioWorkerMessage) => {
        if (message.type !== "outcome") return;
        resolve(message.outcome);
        // Time for pending log writes, without letting a handle left open by
        // the run keep the CLI from exiting.
        const timer = setTimeout(() => void worker.terminate(), EXIT_GRACE_MS);
        worker.once("exit", () => clearTimeout(timer));
      });
      worker.once("error", (error: Error) =>
        resolve(failed(run, startedAt, error.message)),
      );
      // A no-op once the outcome arrived; otherwise the worker died silently.
      worker.once("exit", (code) => {
        this.active.delete(worker);
        resolve(failed(run, startedAt, `worker exited with code ${code}`));
      });
    });
  }

  /** Ask every live worker to hand its emulator back, then stop it. */
  async releaseAll(): Promise<number> {
    this.cancelled = true;
    const counts = await Promise.all(
      [...this.active].map(
        (worker) =>
          new Promise<number>((resolve) => {
            worker.on("message", (message: ScenarioWorkerMessage) => {
              if (message.type === "released") resolve(message.count);
            });
            worker.once("exit", () => resolve(0));
            worker.postMessage("release");
          }),
      ),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  }
}
