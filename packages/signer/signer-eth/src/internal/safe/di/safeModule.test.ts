import { Container } from "inversify";

import { safeModuleFactory } from "./safeModule";

describe("safeModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof safeModuleFactory>;
    beforeEach(() => {
      mod = safeModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the safe module", () => {
      expect(mod).toBeDefined();
    });
  });
});
