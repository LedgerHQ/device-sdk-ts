import { Container } from "inversify";

import { appBindingModuleFactory } from "./appBinderModule";

describe("appBindingModuleFactory", () => {
  it("should return the app-binder module", () => {
    // ARRANGE
    const mod = appBindingModuleFactory();
    const container = new Container();
    // ACT
    container.loadSync(mod);
    // ASSERT
    expect(mod).toBeDefined();
  });
});
