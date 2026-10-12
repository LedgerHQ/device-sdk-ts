import { Container } from "inversify";

import { configModuleFactory } from "./configModule";

describe("configModuleFactory", () => {
  it("should return the config module", () => {
    // ARRANGE
    const mod = configModuleFactory();
    const container = new Container();
    // ACT
    container.loadSync(mod);
    // ASSERT
    expect(mod).toBeDefined();
  });
});
