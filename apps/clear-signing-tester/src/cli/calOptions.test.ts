import { describe, expect, it } from "vitest";

import { type Scenario } from "@root/src/domain/models/Scenario";

import { calBranchWarnings, resolveCalMode } from "./calOptions";

const scenario = (name: string, coinApp: Scenario["coinApp"]): Scenario => ({
  name,
  group: name.split(":")[0]!,
  devices: ["stax"],
  coinApp,
  action: "signTransaction",
  fixture: "./unused.json",
});

describe("resolveCalMode", () => {
  // With neither flag, a run must behave exactly as before the flags existed.
  it("keeps prod mode on main without ERC7730 files", () => {
    expect(resolveCalMode({ branch: "main", hasErc7730Files: false })).toBe(
      "prod",
    );
  });

  it.each(["next", "demo"] as const)(
    "defaults to test mode on %s, whose prod signatures lag",
    (branch) => {
      expect(resolveCalMode({ branch, hasErc7730Files: false })).toBe("test");
    },
  );

  it("defaults to test mode with ERC7730 files, which the test key signs", () => {
    expect(resolveCalMode({ branch: "main", hasErc7730Files: true })).toBe(
      "test",
    );
  });

  // The parity run: main's content through the interceptor.
  it("allows test mode on main", () => {
    expect(
      resolveCalMode({ branch: "main", mode: "test", hasErc7730Files: false }),
    ).toBe("test");
  });

  it("keeps an explicit prod mode on main", () => {
    expect(
      resolveCalMode({ branch: "main", mode: "prod", hasErc7730Files: false }),
    ).toBe("prod");
  });

  it.each(["next", "demo"] as const)(
    "refuses prod mode on %s, which cannot verify",
    (branch) => {
      expect(() =>
        resolveCalMode({ branch, mode: "prod", hasErc7730Files: false }),
      ).toThrow(`--cal-mode prod cannot run --cal-branch ${branch}`);
    },
  );

  it("refuses prod mode with ERC7730 files, which cannot verify", () => {
    expect(() =>
      resolveCalMode({ branch: "main", mode: "prod", hasErc7730Files: true }),
    ).toThrow("--cal-mode prod cannot run --erc7730-files");
  });
});

describe("calBranchWarnings", () => {
  const selection = [
    scenario("erc7730:uniswap", "Ethereum"),
    scenario("tron:trc10", "Tron"),
    scenario("btc-legacy:litecoin", "Litecoin"),
    scenario("btc-legacy:dash", "Dash"),
  ];

  it("says nothing on main", () => {
    expect(calBranchWarnings("main", selection)).toEqual([]);
  });

  it("says nothing when every scenario reads the branch", () => {
    expect(
      calBranchWarnings("next", [
        scenario("erc7730:uniswap", "Ethereum"),
        scenario("solana:spl", "Solana"),
      ]),
    ).toEqual([]);
  });

  it("names the Tron and legacy Bitcoin scenarios the branch cannot change", () => {
    const warnings = calBranchWarnings("next", selection);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("tron:trc10");
    expect(warnings[0]).not.toContain("erc7730:uniswap");
    expect(warnings[1]).toContain("btc-legacy:litecoin, btc-legacy:dash");
  });

  // A scenario selected on several devices appears once per device.
  it("names each scenario once", () => {
    const tron = scenario("tron:trc10", "Tron");

    expect(calBranchWarnings("next", [tron, tron])[0]).toMatch(
      /for tron:trc10: /,
    );
  });
});
