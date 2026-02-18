import { Container } from "inversify";

import { appBindingModuleFactory } from "./appBinderModule";

describe("appBinderModule", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof appBindingModuleFactory>;
    beforeEach(() => {
      mod = appBindingModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return app binder module", () => {
      expect(mod).toBeDefined();
    });
  });
});
