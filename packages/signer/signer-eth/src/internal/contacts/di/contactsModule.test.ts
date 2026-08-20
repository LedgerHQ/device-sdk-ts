import { Container } from "inversify";

import { contactsModuleFactory } from "./contactsModule";

describe("contactsModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof contactsModuleFactory>;
    beforeEach(() => {
      mod = contactsModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the contacts module", () => {
      expect(mod).toBeDefined();
    });
  });
});
