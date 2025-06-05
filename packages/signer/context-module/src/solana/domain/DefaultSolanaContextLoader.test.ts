/* eslint-disable @typescript-eslint/no-explicit-any */
import { DefaultSolanaContextLoader } from "@/solana/domain/DefaultSolanaContextLoader";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

describe("DefaultSolanaContextLoader", () => {
  describe("load", () => {
    it("should call the dataSource with the correct params", async () => {
      // given
      const mockDataSource = {
        getSolanaContext: vi.fn(),
      };
      const context = {
        deviceModelId: "nanoX",
        tokenAddress: "some-token",
        challenge: "mock-challenge",
      } as unknown as SolanaTransactionContext;

      // when
      const loader = new DefaultSolanaContextLoader(mockDataSource as any);
      await loader.load(context);

      // then
      expect(mockDataSource.getSolanaContext).toHaveBeenCalledWith(context);
    });
  });
});
