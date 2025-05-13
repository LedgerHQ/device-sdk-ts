import { Container } from "inversify";

import { sendModuleFactory } from "./sendModule";

describe("sendModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof sendModuleFactory>;
    beforeEach(() => {
      mod = sendModuleFactory({ stub: false });
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });
  });
});
