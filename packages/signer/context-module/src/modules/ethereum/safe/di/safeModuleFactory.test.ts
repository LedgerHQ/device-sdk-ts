import { describe, it } from "vitest";

import { safeModuleFactory } from "./safeModuleFactory";

describe("safeModuleFactory", () => {
  it("should be defined", () => {
    expect(safeModuleFactory).toBeDefined();
  });
});
