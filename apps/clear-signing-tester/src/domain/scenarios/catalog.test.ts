import { existsSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { SCENARIO_CATALOG, scenarioGroups } from "./catalog";

const APP_ROOT = resolve(__dirname, "../../..");

describe("SCENARIO_CATALOG", () => {
  it("names every scenario uniquely", () => {
    const names = SCENARIO_CATALOG.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("points every fixture at a file that exists", () => {
    const missing = SCENARIO_CATALOG.filter(
      (s) => s.fixture && !existsSync(resolve(APP_ROOT, s.fixture)),
    ).map((s) => `${s.name} -> ${s.fixture}`);
    expect(missing).toEqual([]);
  });

  it("gives every scenario at least one device", () => {
    expect(SCENARIO_CATALOG.filter((s) => s.devices.length === 0)).toEqual([]);
  });

  it("gives file-driven actions a fixture and program actions a program", () => {
    for (const s of SCENARIO_CATALOG) {
      if (s.action === "solanaProgram") {
        expect(s.program, s.name).toBeTruthy();
        expect(s.fixture, s.name).toBeUndefined();
      } else {
        expect(s.fixture, s.name).toBeTruthy();
        expect(s.program, s.name).toBeUndefined();
      }
    }
  });

  it("covers the groups CI selects", () => {
    expect(scenarioGroups()).toEqual([
      "core",
      "contacts",
      "gating",
      "erc7730",
      "erc7730-typed-data",
      "solana",
      "solana-programs",
    ]);
  });
});
