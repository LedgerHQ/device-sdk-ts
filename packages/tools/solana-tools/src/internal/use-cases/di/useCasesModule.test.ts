import { Container } from "inversify";

import { useCasesModuleFactory } from "./useCasesModule";
import { useCasesTypes } from "./useCasesTypes";

describe("useCasesModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof useCasesModuleFactory>;
    beforeEach(() => {
      mod = useCasesModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the use cases module", () => {
      expect(mod).toBeDefined();
    });

    it("should bind GenerateTransactionUseCase", () => {
      expect(
        container.isBound(useCasesTypes.GenerateTransactionUseCase),
      ).toBeTruthy();
    });

    it("should bind CraftTransactionUseCase", () => {
      expect(
        container.isBound(useCasesTypes.CraftTransactionUseCase),
      ).toBeTruthy();
    });
  });
});
