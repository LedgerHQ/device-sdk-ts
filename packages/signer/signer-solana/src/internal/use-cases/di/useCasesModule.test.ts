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

    it("should return the address module", () => {
      expect(mod).toBeDefined();
    });

    it("should bind GetAddressUseCase", () => {
      expect(container.isBound(useCasesTypes.GetAddressUseCase)).toBeTruthy();
    });

    it("should bind GetAppConfigurationUseCase", () => {
      expect(
        container.isBound(useCasesTypes.GetAppConfigurationUseCase),
      ).toBeTruthy();
    });

    it("should bind SignTransactionUseCase", () => {
      expect(
        container.isBound(useCasesTypes.SignTransactionUseCase),
      ).toBeTruthy();
    });

    it("should bind SignMessageUseCase", () => {
      expect(container.isBound(useCasesTypes.SignMessageUseCase)).toBeTruthy();
    });

    it("should bind GenerateTransactionUseCase", () => {
      expect(
        container.isBound(useCasesTypes.GenerateTransactionUseCase),
      ).toBeTruthy();
    });

    it("should bind swapTransactionSignerUseCase", () => {
      expect(
        container.isBound(useCasesTypes.SwapTransactionSignerUseCase),
      ).toBeTruthy();
    });
  });
});
