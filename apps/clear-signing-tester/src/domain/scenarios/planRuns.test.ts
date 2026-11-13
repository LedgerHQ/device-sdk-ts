import { afterEach, describe, expect, it, vi } from "vitest";

import { type Scenario } from "@root/src/domain/models/Scenario";

import { planRuns, skipSeedlessScenarios } from "./planRuns";

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

describe("skipSeedlessScenarios", () => {
  const checked: Scenario = {
    ...scenario("tx-check:live", "tx-check", ["stax"]),
    coinApp: "Solana",
    options: { transactionCheckEnabled: true },
  };
  const catalog = [...CATALOG, checked];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps every scenario when a seed is set", () => {
    expect(skipSeedlessScenarios(catalog, ["tx-check"], "funded words")).toBe(
      catalog,
    );
  });

  it.each([[[]], [["all"]]])(
    "leaves them out of %j without a seed, and says so",
    (selectors) => {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(skipSeedlessScenarios(catalog, selectors, undefined)).toEqual(
        CATALOG,
      );
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("tx-check:live"),
      );
    },
  );

  it("leaves them out quietly when other groups are selected", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(skipSeedlessScenarios(catalog, ["core"], undefined)).toEqual(
      CATALOG,
    );
    expect(log).not.toHaveBeenCalled();
  });

  it.each(["tx-check", "tx-check:live"])(
    "refuses %s by name without a seed",
    (selector) => {
      expect(() =>
        skipSeedlessScenarios(catalog, [selector], undefined),
      ).toThrow(/tx-check:live needs GH SPECULOS_SEED/);
    },
  );
});
