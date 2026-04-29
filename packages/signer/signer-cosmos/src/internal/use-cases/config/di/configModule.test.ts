import { Container } from "inversify";

import { configModuleFactory } from "./configModule";

describe("configModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof configModuleFactory>;
    beforeEach(() => {
      mod = configModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });
  });
});
