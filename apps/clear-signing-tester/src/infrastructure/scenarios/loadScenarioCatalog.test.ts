import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { beforeEach, describe, expect, it } from "vitest";

import { isEnabled, loadScenarioCatalog } from "./loadScenarioCatalog";

const ALL = loadScenarioCatalog();
const CATALOG = ALL.filter(isEnabled);

const VALID = {
  group: "demo",
  name: "one",
  action: "signTransaction",
  devices: ["stax"],
  coinApp: "Ethereum",
  cases: [{ rawTx: "0x00" }],
};

describe("loadScenarioCatalog", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "scenarios-"));
  });

  const write = (file: string, body: unknown) =>
    writeFileSync(join(dir, file), JSON.stringify(body));

  it("reads a scenario file and names it group:name", () => {
    write("one.json", VALID);
    expect(loadScenarioCatalog(dir)).toEqual([
      {
        name: "demo:one",
        group: "demo",
        devices: ["stax"],
        coinApp: "Ethereum",
        action: "signTransaction",
        fixture: join(dir, "one.json"),
      },
    ]);
  });

  it("ignores files that declare no action, so plain data can sit alongside", () => {
    write("address-book.json", { entries: [] });
    write("kept-for-manual-runs.json", [{ rawTx: "0x00" }]);
    expect(loadScenarioCatalog(dir)).toEqual([]);
  });

  it("turns mode sequential into the sequential flag", () => {
    write("one.json", { ...VALID, mode: "sequential" });
    expect(loadScenarioCatalog(dir)[0]!.sequential).toBe(true);
  });

  it("leaves a parallel scenario unflagged", () => {
    write("one.json", { ...VALID, mode: "parallel" });
    expect(loadScenarioCatalog(dir)[0]!.sequential).toBeUndefined();
  });

  it("defaults a solanaProgram's program to its name and gives it no fixture", () => {
    write("p.json", {
      group: "solana-programs",
      name: "spl-token",
      action: "solanaProgram",
      devices: ["stax"],
      coinApp: "Solana",
    });
    const scenario = loadScenarioCatalog(dir)[0]!;
    expect(scenario.program).toBe("spl-token");
    expect(scenario.fixture).toBeUndefined();
  });

  it("marks a disabled scenario and leaves an enabled one unflagged", () => {
    write("off.json", { ...VALID, name: "off", enabled: false });
    write("on.json", { ...VALID, name: "on", enabled: true });
    const byName = new Map(
      loadScenarioCatalog(dir).map((s) => [s.name, s.enabled]),
    );
    expect(byName.get("demo:off")).toBe(false);
    expect(byName.get("demo:on")).toBeUndefined();
  });

  it("keeps a disabled scenario out of what isEnabled admits", () => {
    write("off.json", { ...VALID, enabled: false });
    expect(loadScenarioCatalog(dir).filter(isEnabled)).toEqual([]);
  });

  it("carries an optional version pin through", () => {
    write("one.json", {
      ...VALID,
      osVersion: "1.7.0-rc2",
      appVersion: "1.23.0-dev",
    });
    expect(loadScenarioCatalog(dir)[0]).toMatchObject({
      osVersion: "1.7.0-rc2",
      appVersion: "1.23.0-dev",
    });
  });

  it.each([
    ["no group", { ...VALID, group: undefined }, /needs a "group"/],
    ["no name", { ...VALID, name: undefined }, /needs a "name"/],
    [
      "an unknown action",
      { ...VALID, action: "signSomething" },
      /unknown "action"/,
    ],
    ["an unknown coin app", { ...VALID, coinApp: "Doge" }, /unknown "coinApp"/],
    ["no devices", { ...VALID, devices: [] }, /non-empty "devices"/],
    [
      "an unknown device",
      { ...VALID, devices: ["nanox", "abacus"] },
      /unknown device "abacus"/,
    ],
    ["an unknown mode", { ...VALID, mode: "whenever" }, /unknown "mode"/],
    ["no cases", { ...VALID, cases: [] }, /non-empty "cases"/],
    [
      "a non-boolean enabled",
      { ...VALID, enabled: "no" },
      /non-boolean "enabled"/,
    ],
  ])("rejects a file with %s", (_label, body, message) => {
    write("bad.json", body);
    expect(() => loadScenarioCatalog(dir)).toThrow(message);
  });

  it("rejects cases on a solanaProgram, whose input comes from the RPC", () => {
    write("p.json", {
      group: "solana-programs",
      name: "system",
      action: "solanaProgram",
      devices: ["stax"],
      coinApp: "Solana",
      cases: [{ rawTx: "0x00" }],
    });
    expect(() => loadScenarioCatalog(dir)).toThrow(/must not carry "cases"/);
  });

  it("names both files when two declare the same scenario", () => {
    write("a.json", VALID);
    write("b.json", VALID);
    expect(() => loadScenarioCatalog(dir)).toThrow(/both declare "demo:one"/);
  });

  it("names the file when its JSON is broken", () => {
    writeFileSync(join(dir, "broken.json"), "{ not json");
    expect(() => loadScenarioCatalog(dir)).toThrow(
      /broken\.json is not valid JSON/,
    );
  });
});

describe("the shipped catalog", () => {
  it("loads every scenario the app ships", () => {
    expect(CATALOG.length).toBe(42);
  });

  // These are kept in the repo but not run — alternate chains nobody wired up,
  // descriptors known to be broken. Being explicit is what stops them reading
  // as fixtures someone forgot to reference.
  it("keeps the disabled scenarios out of every selection", () => {
    expect(ALL.filter((s) => !isEnabled(s)).map((s) => s.name)).toEqual([
      "core:typed-data-example",
      "erc7730:1inch-arbitrum",
      "erc7730:1inch-polygon",
      "erc7730:1inch-zksync",
      "erc7730:quickswap-polygon",
      "erc7730:velora-polygon",
      "erc7730-typed-data:dispatch",
      "erc7730-typed-data:makerdao",
      "erc7730-typed-data:rarible",
      "solana-programs:spl-token",
      "solana-programs:stake",
      "solana-programs:system",
      "solana-programs:token-2022",
    ]);
  });

  it("names every scenario uniquely", () => {
    const names = CATALOG.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("points every fixture at a file that exists", () => {
    const missing = CATALOG.filter(
      (s) => s.fixture && !existsSync(s.fixture),
    ).map((s) => `${s.name} -> ${s.fixture}`);
    expect(missing).toEqual([]);
  });

  it("gives file-driven actions a fixture and program actions a program", () => {
    for (const s of CATALOG) {
      if (s.action === "solanaProgram") {
        expect(s.program, s.name).toBeTruthy();
        expect(s.fixture, s.name).toBeUndefined();
      } else {
        expect(s.fixture, s.name).toBeTruthy();
        expect(s.program, s.name).toBeUndefined();
      }
    }
  });

  it("pins an OS and an app version together, never one alone", () => {
    for (const s of CATALOG) {
      expect(Boolean(s.osVersion), s.name).toBe(Boolean(s.appVersion));
    }
  });

  // Contacts needs a pre-release app. Folding that into default_versions.json
  // would drag every other flex Ethereum scenario onto the pre-release too,
  // which is what broke the erc7730 typed-data runs.
  it("keeps the contacts scenarios on their own app version", () => {
    const contacts = CATALOG.filter((s) => s.group === "contacts");
    expect(contacts.length).toBeGreaterThan(0);
    for (const s of contacts) {
      expect(s.appVersion, s.name).toBeTruthy();
    }
  });

  // `_txHash` traces a case back to a real transaction. An empty one traces
  // nothing, so it is noise rather than a note.
  it("carries no empty _txHash note", () => {
    const empty = ALL.flatMap((scenario) =>
      scenario.fixture
        ? ((
            JSON.parse(readFileSync(scenario.fixture, "utf-8")) as {
              cases?: Array<Record<string, unknown>>;
            }
          ).cases
            ?.filter((c) => "_txHash" in c && !c["_txHash"])
            .map(() => scenario.name) ?? [])
        : [],
    );
    expect(empty).toEqual([]);
  });

  // Every scenario in solana-programs is disabled, so the group is not
  // selectable at all — a selector naming it would fail as unknown, which is
  // why the Solana nightly asks for the fixtures only.
  it("covers the groups CI selects", () => {
    expect([...new Set(CATALOG.map((s) => s.group))]).toEqual([
      "contacts",
      "core",
      "erc7730",
      "erc7730-typed-data",
      "gating",
      "solana",
    ]);
  });
});
