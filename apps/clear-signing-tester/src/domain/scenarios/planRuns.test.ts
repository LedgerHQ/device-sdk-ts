import { describe, expect, it } from "vitest";

import { type Scenario } from "@root/src/domain/models/Scenario";

import { planRuns } from "./planRuns";

const scenario = (
  name: string,
  group: string,
  devices: Scenario["devices"],
): Scenario => ({
  name,
  group,
  devices,
  coinApp: "Ethereum",
  action: "signTransaction",
  fixture: `./${name}.json`,
});

const CATALOG: Scenario[] = [
  scenario("core:a", "core", ["stax", "nanox"]),
  scenario("core:b", "core", ["stax"]),
  scenario("contacts:a", "contacts", ["flex"]),
];

describe("planRuns", () => {
  it("expands a scenario to one run per supported device", () => {
    const runs = planRuns(CATALOG, ["core:a"]);
    expect(runs.map((r) => r.device)).toEqual(["stax", "nanox"]);
  });

  it("selects a whole group", () => {
    const runs = planRuns(CATALOG, ["core"]);
    expect(runs.map((r) => r.scenario.name)).toEqual([
      "core:a",
      "core:a",
      "core:b",
    ]);
  });

  it("treats no selector as all", () => {
    expect(planRuns(CATALOG, [])).toHaveLength(4);
    expect(planRuns(CATALOG, ["all"])).toHaveLength(4);
  });

  it("keeps only the requested device, dropping scenarios that lack it", () => {
    const runs = planRuns(CATALOG, ["all"], { device: "flex" });
    expect(runs.map((r) => r.scenario.name)).toEqual(["contacts:a"]);
  });

  it("does not run a scenario twice when selectors overlap", () => {
    const runs = planRuns(CATALOG, ["core", "core:a"], { device: "stax" });
    expect(runs.map((r) => r.scenario.name)).toEqual(["core:a", "core:b"]);
  });

  it("rejects an unknown selector and names the groups", () => {
    expect(() => planRuns(CATALOG, ["nope"])).toThrow(
      /Unknown scenario or group "nope".*contacts, core/s,
    );
  });
});
