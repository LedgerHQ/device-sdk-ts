---
to: src/internal/<%= moduleName %>/di/<%= moduleName %>Module.test.ts
---
import { Container } from "inversify";
import <%= moduleName %>ModuleFactory from "./<%= moduleName %>Module";
import { types } from "./<%= moduleName %>Types";

describe("<%= moduleName %>ModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof <%= moduleName %>ModuleFactory>;
    beforeEach(() => {
      mod = <%= moduleName %>ModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });
  });
});