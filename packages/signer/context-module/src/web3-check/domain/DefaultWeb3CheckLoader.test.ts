import { DefaultWeb3CheckContextLoader } from "@/web3-check/domain/DefaultWeb3CheckLoader";
import { type Web3CheckContext } from "@/web3-check/domain/web3CheckTypes";

describe("DefaultWeb3CheckLoader", () => {
  describe("load", () => {
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
