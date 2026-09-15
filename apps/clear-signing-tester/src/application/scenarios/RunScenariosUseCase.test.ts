import { describe, expect, it, vi } from "vitest";

import {
  type Scenario,
  type ScenarioRun,
} from "@root/src/domain/models/Scenario";
import { type ScenarioOutcome } from "@root/src/domain/models/ScenarioOutcome";
import { type ScenarioRunner } from "@root/src/domain/services/ScenarioRunner";

import { RunScenariosUseCase } from "./RunScenariosUseCase";

const run = (name: string): ScenarioRun => ({
  scenario: {
    name,
    group: "g",
    devices: ["stax"],
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./x.json",
  } satisfies Scenario,
  device: "stax",
});

const outcome = (r: ScenarioRun, failures: number): ScenarioOutcome => ({
  run: r,
  counts: {
    clearSigned: 0,
    partiallyClearSigned: 0,
    blindSigned: 0,
    error: failures,
  },
  failures,
  failedCases: [],
  durationMs: 1,
});

describe("RunScenariosUseCase retries", () => {
  const theRun = run("demo:retry");

  it("takes a second emulator when the first attempt failed", async () => {
    const outcomes = [
      outcome(theRun, 1),
      {
        ...outcome(theRun, 0),
        counts: {
          clearSigned: 2,
          partiallyClearSigned: 0,
          blindSigned: 0,
          error: 0,
        },
      },
    ];
    let calls = 0;
    const runner = { run: () => Promise.resolve(outcomes[calls++]!) };
    const retries: number[] = [];

    const report = await new RunScenariosUseCase(runner).execute([theRun], {
      concurrency: 1,
      onRetry: (_o, attempt) => retries.push(attempt),
    });

    expect(calls).toBe(2);
    expect(retries).toEqual([2]);
    expect(report.failures).toBe(0);
  });

  it("gives up after the second emulator rather than looping", async () => {
    let calls = 0;
    const runner = {
      run: () => {
        calls++;
        return Promise.resolve(outcome(theRun, 1));
      },
    };

    const report = await new RunScenariosUseCase(runner).execute([theRun], {
      concurrency: 1,
    });

    expect(calls).toBe(2);
    expect(report.failures).toBe(1);
  });
});

describe("RunScenariosUseCase", () => {
  it("sums failures across scenarios", async () => {
    const runner: ScenarioRunner = {
      run: (r) => Promise.resolve(outcome(r, 2)),
    };
    const report = await new RunScenariosUseCase(runner).execute(
      [run("a"), run("b")],
      { concurrency: 2 },
    );
    expect(report.failures).toBe(4);
  });

  it("keeps outcomes in input order even when they finish out of order", async () => {
    const runner: ScenarioRunner = {
      run: async (r) => {
        // "a" finishes last
        await new Promise((res) =>
          setTimeout(res, r.scenario.name === "a" ? 20 : 1),
        );
        return outcome(r, 0);
      },
    };
    const report = await new RunScenariosUseCase(runner).execute(
      [run("a"), run("b"), run("c")],
      { concurrency: 3 },
    );
    expect(report.outcomes.map((o) => o.run.scenario.name)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const runner: ScenarioRunner = {
      run: async (r) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((res) => setTimeout(res, 5));
        inFlight -= 1;
        return outcome(r, 0);
      },
    };
    await new RunScenariosUseCase(runner).execute(
      ["a", "b", "c", "d", "e"].map(run),
      { concurrency: 2 },
    );
    expect(peak).toBe(2);
  });

  it("reports progress as scenarios finish", async () => {
    const onOutcome = vi.fn();
    const runner: ScenarioRunner = {
      run: (r) => Promise.resolve(outcome(r, 0)),
    };
    await new RunScenariosUseCase(runner).execute([run("a"), run("b")], {
      concurrency: 1,
      onOutcome,
    });
    expect(onOutcome).toHaveBeenCalledTimes(2);
    expect(onOutcome.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("runs nothing when given nothing", async () => {
    const runner: ScenarioRunner = { run: vi.fn() };
    const report = await new RunScenariosUseCase(runner).execute([], {
      concurrency: 4,
    });
    expect(report).toEqual({ outcomes: [], failures: 0 });
    expect(runner.run).not.toHaveBeenCalled();
  });
});
