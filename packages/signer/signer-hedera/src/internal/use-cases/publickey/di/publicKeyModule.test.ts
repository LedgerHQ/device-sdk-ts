import { Container } from "inversify";

import { publicKeyModuleFactory } from "./publicKeyModule";

describe("publicKeyModuleFactory", () => {
  it("should return the public key module", () => {
    // ARRANGE
    const mod = publicKeyModuleFactory();
    const container = new Container();
    // ACT
    container.loadSync(mod);
    // ASSERT
    expect(mod).toBeDefined();
  });
});
