import { generateSignatureId } from "./generateSignatureId";

describe("generateSignatureId", () => {
  it("should return a string matching <6 alphanumeric chars>-<unix timestamp>", () => {
    const id = generateSignatureId();
    expect(id).toMatch(/^[A-Za-z0-9]{6}-\d+$/);
  });

  it("should produce a 6-char random prefix", () => {
    const id = generateSignatureId();
    const prefix = id.split("-")[0]!;
    expect(prefix).toHaveLength(6);
  });

  it("should include a numeric timestamp after the hyphen", () => {
    const before = Date.now();
    const id = generateSignatureId();
    const after = Date.now();

    const timestamp = Number(id.split("-")[1]);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("should produce unique values on successive calls", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => generateSignatureId()),
    );
    // All 50 should be unique (random prefix makes collisions extremely unlikely)
    expect(ids.size).toBe(50);
  });

  it("should only use alphanumeric characters in the random prefix", () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 100; i++) {
      const prefix = generateSignatureId().split("-")[0]!;
      expect(prefix).toMatch(/^[A-Za-z0-9]+$/);
    }
  });
});
