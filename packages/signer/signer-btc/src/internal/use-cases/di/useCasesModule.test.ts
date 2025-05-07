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

    it("should bind GetExtendedPublicKeyUseCase", () => {
      expect(
        container.isBound(useCasesTypes.GetExtendedPublicKeyUseCase),
      ).toBeTruthy();
    });

    it("should bind SignMessageUseCase", () => {
      expect(container.isBound(useCasesTypes.SignMessageUseCase)).toBeTruthy();
    });

    it("should bind GetWalletAddressUseCase", () => {
      expect(
        container.isBound(useCasesTypes.GetWalletAddressUseCase),
      ).toBeTruthy();
    });
  });
});
