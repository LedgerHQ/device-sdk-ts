import { Container } from "inversify";

import { addressModuleFactory } from "./addressModule";
import { addressTypes } from "./addressTypes";

describe("addressModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof addressModuleFactory>;
    beforeEach(() => {
      mod = addressModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the address module", () => {
      expect(mod).toBeDefined();
    });

    it("should bind GetAddressUseCase", () => {
      expect(container.isBound(addressTypes.GetAddressUseCase)).toBeTruthy();
    });
  });
});
