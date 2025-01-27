import { Container } from "inversify";

import { addressModuleFactory } from "./addressModule";

describe("addressModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof addressModuleFactory>;
    beforeEach(() => {
      mod = addressModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the address module", () => {
      expect(mod).toBeDefined();
    });
  });
});
