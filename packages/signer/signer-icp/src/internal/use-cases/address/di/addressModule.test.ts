import { Container } from "inversify";

import { addressModuleFactory } from "./addressModule";

describe("addressModuleFactory", () => {
  it("should return the address module", () => {
    // ARRANGE
    const mod = addressModuleFactory();
    const container = new Container();
    // ACT
    container.loadSync(mod);
    // ASSERT
    expect(mod).toBeDefined();
  });
});
