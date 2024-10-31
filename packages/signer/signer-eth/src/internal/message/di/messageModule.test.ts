import { Container } from "inversify";

import { messageModuleFactory } from "./messageModule";

describe("messageModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof messageModuleFactory>;
    beforeEach(() => {
      mod = messageModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the message module", () => {
      expect(mod).toBeDefined();
    });
  });
});
