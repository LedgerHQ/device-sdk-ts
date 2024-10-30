import { Container } from "inversify";

import { psbtModuleFactory } from "./psbtModule";

describe("PsbtModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof psbtModuleFactory>;
    beforeEach(() => {
      mod = psbtModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the psbt service module", () => {
      expect(mod).toBeDefined();
    });
  });
});
