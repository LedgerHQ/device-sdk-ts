import { describe, expect, it } from "vitest";

import { sumUpTo } from "./sonarCoverageProbe";

// Only sumUpTo is exercised; normalizeCsv is intentionally left uncovered so
// coverage on new code lands around 50%.
describe("sumUpTo", () => {
  it("sums integers below n", () => {
    expect(sumUpTo(5)).toBe(10);
  });

  it("caps the total at 100", () => {
    expect(sumUpTo(50)).toBe(100);
  });
});
