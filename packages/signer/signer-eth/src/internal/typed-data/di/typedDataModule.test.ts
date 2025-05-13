import { Container } from "inversify";

import { typedDataModuleFactory } from "./typedDataModule";

describe("TypedDataModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof typedDataModuleFactory>;
    beforeEach(() => {
      mod = typedDataModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the typed data module", () => {
      expect(mod).toBeDefined();
    });
  });
});
