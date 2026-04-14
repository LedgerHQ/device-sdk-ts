import { generateSignatureId } from "./SignatureIdUtils";

describe("generateSignatureId", () => {
  it("should return a string matching <6 alphanumeric chars>-<unix timestamp ms>", () => {
    const id = generateSignatureId();
    expect(id).toMatch(/^[A-Za-z0-9]{6}-\d+$/);
  });

  it("should embed a recent timestamp", () => {
    const before = Date.now();
    const id = generateSignatureId();
    const after = Date.now();

    const timestamp = Number(id.split("-")[1]);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("should produce unique ids on successive calls", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => generateSignatureId()),
    );
    expect(ids.size).toBe(50);
  });
});
