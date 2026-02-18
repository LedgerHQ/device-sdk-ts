import { Container } from "inversify";

import { transactionModuleFactory } from "./transactionModule";

describe("transactionModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof transactionModuleFactory>;
    beforeEach(() => {
      mod = transactionModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the transaction module", () => {
      expect(mod).toBeDefined();
    });
  });
});
