import { Left } from "purify-ts";

import { DefaultWeb3CheckContextLoader } from "@/web3-check/domain/DefaultWeb3CheckLoader";
import { type Web3CheckContext } from "@/web3-check/domain/web3CheckTypes";

describe("DefaultWeb3CheckLoader", () => {
  describe("load", () => {
    it("should return an error if the rawTx is undefined", async () => {
      // GIVEN
      const dataSource = {
        getWeb3Checks: vi.fn(),
      };
      const web3CheckContext = {
        from: "from",
        rawTx: undefined,
        chainId: 1,
      } as unknown as Web3CheckContext;

      // WHEN
      const loader = new DefaultWeb3CheckContextLoader(dataSource);
      const result = await loader.load(web3CheckContext);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] Web3CheckContextLoader: cannot load web checks with undefined `rawTx` field params",
          ),
        ),
      );
    });

    it("should return an error if the from is undefined", async () => {
      // GIVEN
      const dataSource = {
        getWeb3Checks: vi.fn(),
      };
      const web3CheckContext = {
        from: undefined,
        rawTx: "rawTx",
        chainId: 1,
      } as unknown as Web3CheckContext;

      // WHEN
      const loader = new DefaultWeb3CheckContextLoader(dataSource);
      const result = await loader.load(web3CheckContext);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] Web3CheckContextLoader: cannot load web checks with undefined `from` field params",
          ),
        ),
      );
    });

    it("should call the dataSource with the correct params", async () => {
      // GIVEN
      const dataSource = {
        getWeb3Checks: vi.fn(),
      };
      const web3CheckContext = {
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      } as unknown as Web3CheckContext;

      // WHEN
      const loader = new DefaultWeb3CheckContextLoader(dataSource);
      await loader.load(web3CheckContext);

      // THEN
      expect(dataSource.getWeb3Checks).toHaveBeenCalledWith({
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      });
    });
  });
});
