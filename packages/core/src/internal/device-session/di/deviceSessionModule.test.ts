import { Container } from "inversify";

import deviceSessionModuleFactory from "./deviceSessionModule";
import { types } from "./deviceSessionTypes";

describe("deviceSessionModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof deviceSessionModuleFactory>;
    beforeEach(() => {
      mod = deviceSessionModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });
  });
});