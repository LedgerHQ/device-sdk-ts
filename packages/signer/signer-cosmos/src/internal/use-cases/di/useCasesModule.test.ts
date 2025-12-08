import { Container } from "inversify";

import { useCasesModuleFactory } from "@internal/use-cases/di/useCasesModule";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";

describe("useCasesModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof useCasesModuleFactory>;
    beforeEach(() => {
      mod = useCasesModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the address module", () => {
      expect(mod).toBeDefined();
    });

    it("should bind GetAddressUseCase", () => {
      expect(container.isBound(useCasesTypes.GetAddressUseCase)).toBeTruthy();
    });

    it("should bind SignTransactionUseCase", () => {
      expect(
        container.isBound(useCasesTypes.SignTransactionUseCase),
      ).toBeTruthy();
    });
  });
});
