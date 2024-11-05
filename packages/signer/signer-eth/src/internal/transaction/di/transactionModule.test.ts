import { Container } from "inversify";

import { transactionModuleFactory } from "./transactionModule";
import { transactionTypes } from "./transactionTypes";

describe("transactionModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof transactionModuleFactory>;
    beforeEach(() => {
      mod = transactionModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the transaction module", () => {
      expect(mod).toBeDefined();
    });

    it("should bind a list of transaction mappers", () => {
      expect(
        container.getAll(transactionTypes.TransactionMappers),
      ).toHaveLength(2);
    });
  });
});