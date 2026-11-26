import { describe, expect, it } from "vitest";

import { TYPES } from "@root/src/di/types";
import { type CalConfig } from "@root/src/domain/models/config/CalConfig";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
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
  tronDerivationPath: "44'/195'/0'/0/0",
  logLevel: "none",
  originToken: "test-origin-token",
  calMode: "prod",
  calBranch: "main",
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

  // Every other scenario's expected texts carry the default wallet's addresses.
  it.each([
    [true, "funded wallet words"],
    [false, undefined],
  ])(
    "boots on the funded seed only when transactionCheckEnabled is %s",
    (transactionCheckEnabled, seed) => {
      const runner = new ContainerScenarioRunner({
        ...RUNTIME,
        speculosSeed: "funded wallet words",
      });

      const container = runner["buildContainer"]({
        scenario: {
          ...RUN.scenario,
          coinApp: "Solana",
          options: { transactionCheckEnabled },
        },
        device: "stax",
      });

      expect(container.get<SpeculinhoConfig>(TYPES.SpeculinhoConfig).seed).toBe(
        seed,
      );
    },
  );

  // Every signer reads CAL through this config, so a branch lost here would
  // quietly test main.
  it.each(["Ethereum", "Solana", "Tron", "Litecoin"] as const)(
    "hands the run's CAL branch and mode to a %s container",
    (coinApp) => {
      const runner = new ContainerScenarioRunner({
        ...RUNTIME,
        calMode: "test",
        calBranch: "next",
      });

      const container = runner["buildContainer"]({
        scenario: { ...RUN.scenario, coinApp },
        device: "stax",
      });

      expect(container.get<CalConfig>(TYPES.CalConfig)).toEqual({
        url: "https://global.api.prd.ledger.com/cal/v1",
        mode: "test",
        branch: "next",
      });
    },
  );

  it("reads CAL main in prod mode by default", () => {
    const container = new ContainerScenarioRunner(RUNTIME)["buildContainer"](
      RUN,
    );

    expect(container.get<CalConfig>(TYPES.CalConfig)).toEqual({
      url: "https://global.api.prd.ledger.com/cal/v1",
      mode: "prod",
      branch: "main",
    });
  });

  // Naming one elsewhere would run the scenario as if it had none.
  it("refuses an address book on a coin app whose signer takes none", async () => {
    const run: ScenarioRun = {
      scenario: {
        ...RUN.scenario,
        coinApp: "Solana",
        options: { addressBook: "./ressources/tron/address-book.json" },
      },
      device: "stax",
    };

    await expect(new ContainerScenarioRunner(RUNTIME).run(run)).rejects.toThrow(
      "Solana scenarios cannot name an address book",
    );
  });
});
