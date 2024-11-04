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
      container.load(mod);
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
  });
});
