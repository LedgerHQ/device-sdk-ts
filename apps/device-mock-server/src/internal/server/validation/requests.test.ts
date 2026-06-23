import {
  decodeMockConfig,
  decodeSessionImport,
} from "@internal/server/validation/requests";

describe("decodeMockConfig", () => {
  it("accepts a single-response mock", () => {
    const result = decodeMockConfig({
      prefix: "e0010000",
      response: "deadbeef9000",
    });
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toMatchObject({ prefix: "e0010000" });
  });

  it("accepts a multi-response mock", () => {
    const result = decodeMockConfig({
      prefix: "e0010000",
      responses: ["9000", "6d00"],
    });
    expect(result.isRight()).toBe(true);
  });

  it("rejects a mock without any response", () => {
    const result = decodeMockConfig({ prefix: "e0010000" });
    expect(result.isLeft()).toBe(true);
    expect(result.leftToMaybe().extract()).toMatch(/response/);
  });

  it("rejects a mock with an empty responses array", () => {
    const result = decodeMockConfig({ prefix: "e0010000", responses: [] });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects a structurally invalid body", () => {
    const result = decodeMockConfig({ response: "9000" });
    expect(result.isLeft()).toBe(true);
  });
});

describe("decodeSessionImport", () => {
  it("accepts a snapshot whose device mocks all carry a response", () => {
    const result = decodeSessionImport({
      devices: [
        {
          device_type: "nanoX",
          firmware_version: "1.3.0",
          apps: [],
          mocks: [{ prefix: "e0010000", response: "9000" }],
        },
      ],
    });
    expect(result.isRight()).toBe(true);
  });

  it("accepts a snapshot with no mocks", () => {
    const result = decodeSessionImport({
      devices: [
        {
          device_type: "nanoX",
          firmware_version: "1.3.0",
          apps: [],
        },
      ],
    });
    expect(result.isRight()).toBe(true);
  });

  it("rejects a snapshot whose device mock lacks a response", () => {
    const result = decodeSessionImport({
      devices: [
        {
          device_type: "nanoX",
          firmware_version: "1.3.0",
          apps: [],
          mocks: [{ prefix: "e0010000" }],
        },
      ],
    });
    expect(result.isLeft()).toBe(true);
  });

  it("rejects a structurally invalid snapshot", () => {
    const result = decodeSessionImport({ devices: "nope" });
    expect(result.isLeft()).toBe(true);
  });
});
