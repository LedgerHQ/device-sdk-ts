import { Container } from "inversify";

import { walletModuleFactory } from "./walletModule";

describe("WalletModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof walletModuleFactory>;
    beforeEach(() => {
      mod = walletModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the wallet service module", () => {
      expect(mod).toBeDefined();
    });
  });
});
