import { Container } from "inversify";

import { transactionModuleFactory } from "./transactionModule";
import { transactionTypes } from "./transactionTypes";

describe("transactionModuleFactory", () => {
  it("should bind the transaction use-cases", () => {
    // ARRANGE
    const mod = transactionModuleFactory();
    const container = new Container();
    // ACT
    container.loadSync(mod);
    // ASSERT
    expect(container.isBound(transactionTypes.SignTransactionUseCase)).toBe(
      true,
    );
    expect(container.isBound(transactionTypes.SignUpdateCallUseCase)).toBe(
      true,
    );
  });
});
