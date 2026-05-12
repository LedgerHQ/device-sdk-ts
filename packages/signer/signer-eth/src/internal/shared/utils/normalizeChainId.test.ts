import { normalizeChainId } from "./normalizeChainId";

describe("normalizeChainId", () => {
  it("should return null for null", () => {
    expect(normalizeChainId(null)).toBeNull();
  });

  it("should return null for undefined", () => {
    expect(normalizeChainId(undefined)).toBeNull();
  });

  it("should return the number for a safe integer number", () => {
    expect(normalizeChainId(1)).toBe(1);
    expect(normalizeChainId(137)).toBe(137);
    expect(normalizeChainId(0)).toBe(0);
  });

  it("should return null for NaN", () => {
    expect(normalizeChainId(NaN)).toBeNull();
  });

  it("should return null for a non-integer number", () => {
    expect(normalizeChainId(1.5)).toBeNull();
  });

  it("should return null for an unsafe integer", () => {
    expect(normalizeChainId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  it("should parse a decimal string", () => {
    expect(normalizeChainId("1")).toBe(1);
    expect(normalizeChainId("137")).toBe(137);
  });

  it("should parse a hex string", () => {
    expect(normalizeChainId("0x1")).toBe(1);
    expect(normalizeChainId("0x89")).toBe(137);
  });

  it("should return null for an empty string", () => {
    expect(normalizeChainId("")).toBeNull();
    expect(normalizeChainId("   ")).toBeNull();
  });

  it("should return null for a non-numeric string", () => {
    expect(normalizeChainId("abc")).toBeNull();
    expect(normalizeChainId("0xZZ")).toBeNull();
  });

  it("should return null for an object", () => {
    expect(normalizeChainId({})).toBeNull();
    expect(normalizeChainId([])).toBeNull();
  });

  it("should return null for a boolean", () => {
    expect(normalizeChainId(true)).toBeNull();
    expect(normalizeChainId(false)).toBeNull();
  });
});
