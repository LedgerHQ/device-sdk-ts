import { describe, expect, it } from "vitest";

import {
  type Scenario,
  type ScenarioRun,
} from "@root/src/domain/models/Scenario";

import { expandToCases } from "./expandToCases";

const scenario = (name: string, extra: Partial<Scenario> = {}): Scenario => ({
  name,
  group: "g",
  devices: ["stax"],
  coinApp: "Ethereum",
  action: "signTransaction",
  fixture: `./${name}.json`,
  ...extra,
});

const run = (s: Scenario): ScenarioRun => ({ scenario: s, device: "stax" });

describe("expandToCases", () => {
  it("gives every case its own run", () => {
    const out = expandToCases([run(scenario("a"))], { a: 3 });
    expect(out.map((r) => r.slice)).toEqual([
      { index: 1, count: 3 },
      { index: 2, count: 3 },
      { index: 3, count: 3 },
    ]);
  });

  it("keeps a sequential scenario whole", () => {
    const out = expandToCases([run(scenario("a", { sequential: true }))], {
      a: 11,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.slice).toBeUndefined();
  });

  it("keeps a scenario whole when its case count is unknown", () => {
    const out = expandToCases(
      [run(scenario("prog", { action: "solanaProgram" }))],
      {},
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.slice).toBeUndefined();
  });

  it("does not slice a single-case fixture", () => {
    const out = expandToCases([run(scenario("a"))], { a: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]!.slice).toBeUndefined();
  });

  it("expands every device of every scenario", () => {
    const a = scenario("a");
    const runs: ScenarioRun[] = [
      { scenario: a, device: "stax" },
      { scenario: a, device: "nanox" },
    ];
    const out = expandToCases(runs, { a: 2 });
    expect(out).toHaveLength(4);
    expect(out.map((r) => `${r.device}:${r.slice?.index}`)).toEqual([
      "stax:1",
      "stax:2",
      "nanox:1",
      "nanox:2",
    ]);
  });
});
