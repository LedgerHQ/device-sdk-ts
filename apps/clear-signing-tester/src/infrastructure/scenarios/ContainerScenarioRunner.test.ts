import { describe, expect, it } from "vitest";

import {
  type Scenario,
  type ScenarioRun,
} from "@root/src/domain/models/Scenario";

import {
  ContainerScenarioRunner,
  type ScenarioRuntime,
} from "./ContainerScenarioRunner";

const RUNTIME: ScenarioRuntime = {
  ethDerivationPath: "44'/60'/0'/0/0",
  solanaDerivationPath: "44'/501'/0'",
  logLevel: "none",
  originToken: "test-origin-token",
  calMode: "prod",
};

const RUN: ScenarioRun = {
  scenario: {
    name: "demo:one",
    group: "demo",
    devices: ["stax"],
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./ressources/core/raw-erc20.json",
  } satisfies Scenario,
  device: "stax",
};

describe("ContainerScenarioRunner", () => {
  it("releases nothing when it holds nothing", async () => {
    await expect(
      new ContainerScenarioRunner(RUNTIME).releaseAll(),
    ).resolves.toBe(0);
  });

  // The signal handler and the worker pool race: a worker can pick up the next
  // run just as the interrupt arrives. Acquiring a pod there would strand it,
  // since nothing is left to release it.
  it("acquires no emulator for a run started after releaseAll", async () => {
    const runner = new ContainerScenarioRunner(RUNTIME);
    await runner.releaseAll();

    const outcome = await runner.run(RUN);

    expect(outcome.errorMessage).toBe("cancelled before it started");
    expect(outcome.durationMs).toBe(0);
    // Counted as a failure, so a cancelled run cannot report as green.
    expect(outcome.failures).toBe(1);
  });
});
