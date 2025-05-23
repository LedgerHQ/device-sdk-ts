import { Container } from "inversify";

import { merkleTreeModuleFactory } from "./merkleTreeModule";

describe("MerkleTreeModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof merkleTreeModuleFactory>;
    beforeEach(() => {
      mod = merkleTreeModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the merkle tree service module", () => {
      expect(mod).toBeDefined();
    });
  });
});
