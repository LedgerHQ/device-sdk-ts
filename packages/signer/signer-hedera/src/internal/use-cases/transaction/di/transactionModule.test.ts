import { Container } from "inversify";

import { transactionModuleFactory } from "./transactionModule";

describe("transactionModuleFactory", () => {
  it("should return the transaction module", () => {
    // ARRANGE
    const mod = transactionModuleFactory();
    const container = new Container();
    // ACT
    container.loadSync(mod);
    // ASSERT
    expect(mod).toBeDefined();
  });
});
