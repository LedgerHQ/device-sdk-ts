import { Container } from "inversify";

import { deviceSessionModuleFactory } from "./deviceSessionModule";

describe("deviceSessionModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof deviceSessionModuleFactory>;
    beforeEach(() => {
      mod = deviceSessionModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });
  });
});
