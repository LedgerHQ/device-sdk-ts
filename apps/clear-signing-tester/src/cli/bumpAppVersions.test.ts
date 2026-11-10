import { describe, expect, it } from "vitest";

import { bumpAppVersions, type CatalogueDevices } from "./bumpAppVersions";

describe("bumpAppVersions", () => {
  const pins = {
    stax: {
      "1.10.1": { Ethereum: "1.22.3", "Bitcoin Cash": "2.4.13" },
    },
  };

  const catalogue = (
    firmware: CatalogueDevices[string]["firmware"],
  ): CatalogueDevices => ({ stax: { firmware } });

  it("keeps the pins when Speculinho has no newer stable version", () => {
    const result = bumpAppVersions(
      pins,
      catalogue({
        "1.10.1": { Ethereum: ["1.22.3", "1.23.0-rc1", "1.24.0-dev"] },
        "1.12.0-rc1": { Ethereum: ["1.25.0"] },
      }),
      ["Ethereum"],
    );

    expect(result).toEqual({ pins, bumps: [] });
  });

  it("keeps the OS when it carries the new version", () => {
    const result = bumpAppVersions(
      pins,
      catalogue({
        "1.10.1": { Ethereum: ["1.22.3", "1.23.0"] },
        "1.11.0": { Ethereum: ["1.23.0"] },
      }),
      ["Ethereum"],
    );

    expect(result.pins).toEqual({
      stax: { "1.10.1": { Ethereum: "1.23.0", "Bitcoin Cash": "2.4.13" } },
    });
    expect(result.bumps).toEqual([
      {
        device: "stax",
        app: "Ethereum",
        fromOs: "1.10.1",
        toOs: "1.10.1",
        fromVersion: "1.22.3",
        toVersion: "1.23.0",
      },
    ]);
  });

  it("moves to the oldest stable OS carrying the new version", () => {
    const result = bumpAppVersions(
      pins,
      catalogue({
        "1.10.1": { Ethereum: ["1.22.3"] },
        "1.12.0": { Ethereum: ["1.24.0"] },
        "1.11.0": { Ethereum: ["1.24.0"] },
      }),
      ["Ethereum"],
    );

    expect(result.pins).toEqual({
      stax: {
        "1.10.1": { "Bitcoin Cash": "2.4.13" },
        "1.11.0": { Ethereum: "1.24.0" },
      },
    });
  });

  it("drops an OS left without apps", () => {
    const result = bumpAppVersions(
      pins,
      catalogue({
        "1.11.0": { Ethereum: ["1.24.0"], BitcoinCash: ["2.4.14"] },
      }),
      ["Ethereum", "Bitcoin Cash"],
    );

    expect(result.pins).toEqual({
      stax: { "1.11.0": { Ethereum: "1.24.0", "Bitcoin Cash": "2.4.14" } },
    });
  });

  it("leaves the apps of other families alone", () => {
    const result = bumpAppVersions(
      pins,
      catalogue({
        "1.10.1": { Ethereum: ["1.23.0"], BitcoinCash: ["2.4.14"] },
      }),
      ["Bitcoin Cash"],
    );

    expect(result.pins).toEqual({
      stax: { "1.10.1": { Ethereum: "1.22.3", "Bitcoin Cash": "2.4.14" } },
    });
  });
});
