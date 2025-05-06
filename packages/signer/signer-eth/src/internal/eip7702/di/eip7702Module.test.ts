import { Container } from "inversify";

import { eip7702ModuleFactory } from "./eip7702Module";

describe("eip7702ModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof eip7702ModuleFactory>;
    beforeEach(() => {
      mod = eip7702ModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the eip7702 module", () => {
      expect(mod).toBeDefined();
    });
  });
});
