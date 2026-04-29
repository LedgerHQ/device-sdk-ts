import { Container } from "inversify";

import { appBinderModuleFactory } from "./appBinderModule";

describe("appBinderModule", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof appBinderModuleFactory>;
    beforeEach(() => {
      mod = appBinderModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return appBinder module", () => {
      expect(mod).toBeDefined();
    });
  });
});
