import {
  buildRunId,
  mapCoinApp,
  mapDeviceModel,
  parseOpenApp,
} from "./openApp";

describe("parseOpenApp", () => {
  it("extracts the app name from a well-formed open-app APDU", () => {
    // e0 d8 00 00 07 "Bitcoin"
    expect(parseOpenApp("e0d8000007426974636f696e")).toBe("Bitcoin");
  });

  it("is case-insensitive on the hex and tolerates a 0x prefix", () => {
    expect(parseOpenApp("0xE0D8000007426974636F696E")).toBe("Bitcoin");
  });

  it("returns null for non open-app APDUs", () => {
    expect(parseOpenApp("b0010000")).toBeNull(); // GetAppAndVersion
    expect(parseOpenApp("e0de000000")).toBeNull(); // ListApps
  });

  it("returns null for malformed / truncated APDUs", () => {
    expect(parseOpenApp("e0d8")).toBeNull();
    expect(parseOpenApp("e0d8000005ffff")).toBeNull(); // len says 5, data is 2
  });
});

describe("mapCoinApp", () => {
  it("maps known BOLOS names to their Speculos coin id", () => {
    expect(mapCoinApp("Bitcoin")).toBe("btc");
    expect(mapCoinApp("ethereum")).toBe("eth");
  });

  it("falls back to a lower-cased, space-stripped name", () => {
    expect(mapCoinApp("My App")).toBe("myapp");
  });
});

describe("mapDeviceModel", () => {
  it("maps DMK device types to Speculinho models", () => {
    expect(mapDeviceModel("nanoX")).toBe("nanox");
    expect(mapDeviceModel("nanoSP")).toBe("nanosp");
    expect(mapDeviceModel("stax")).toBe("stax");
    expect(mapDeviceModel("flex")).toBe("flex");
  });

  it("returns null for unsupported models", () => {
    expect(mapDeviceModel("blue")).toBeNull();
  });
});

describe("buildRunId", () => {
  it("produces a DNS-1123 label", () => {
    const runId = buildRunId("btc", "nanox");
    expect(runId).toMatch(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/);
    expect(runId).toContain("btc");
    expect(runId).toContain("nanox");
  });
});
