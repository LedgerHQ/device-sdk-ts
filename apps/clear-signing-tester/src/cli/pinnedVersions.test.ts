import { describe, expect, it } from "vitest";

import { loadScenarioCatalog } from "@root/src/infrastructure/scenarios/loadScenarioCatalog";

import { pinnedVersions } from "./pinnedVersions";

describe("pinnedVersions", () => {
  // The runner resolves a device pin for every run, so a default_versions.json
  // that does not cover the catalog fails only once a pod is being acquired. tsc
  // cannot see it, since the versions are data.
  it("resolves a pair for every scenario and device in the catalog", () => {
    const unresolved = loadScenarioCatalog().flatMap((scenario) =>
      scenario.devices.flatMap((device) => {
        try {
          pinnedVersions(scenario.coinApp, device);
          return [];
        } catch (error) {
          return [`${scenario.name} @ ${device}: ${(error as Error).message}`];
        }
      }),
    );
    expect(unresolved).toEqual([]);
  });

  it("reports the device when nothing is pinned for it", () => {
    expect(() => pinnedVersions("Ethereum", "nanos")).toThrow(/"nanos"/);
  });

  it("reports the app when the device pins no such app", () => {
    expect(() => pinnedVersions("Bitcoin", "stax")).toThrow(/Bitcoin/);
  });
});
