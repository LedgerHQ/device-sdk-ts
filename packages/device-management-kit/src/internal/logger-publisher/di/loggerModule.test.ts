import { Container } from "inversify";

import { loggerModuleFactory } from "./loggerModule";

describe("loggerModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof loggerModuleFactory>;
    beforeEach(() => {
      mod = loggerModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });
  });
});
