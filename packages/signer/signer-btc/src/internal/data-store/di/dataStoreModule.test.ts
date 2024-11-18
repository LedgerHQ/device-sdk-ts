import { Container } from "inversify";

import { dataStoreModuleFactory } from "./dataStoreModule";

describe("DataStoreModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof dataStoreModuleFactory>;
    beforeEach(() => {
      mod = dataStoreModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the data store service module", () => {
      expect(mod).toBeDefined();
    });
  });
});
