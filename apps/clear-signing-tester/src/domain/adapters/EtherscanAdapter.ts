import type { TransactionData } from "@root/src/domain/models/TransactionData";

/**
 * Etherscan Adapter Interface
 *
 * Provides abstraction for interacting with Etherscan API.
 * Allows fetching random transaction by chain ID, address, and function selector.
 */
export interface EtherscanAdapter {
  /**
   * Fetch random transaction filtered by chain ID, address, and selector
   * @param chainId - The blockchain chain ID
   * @param address - The contract address to filter transactions
   * @param selector - The function selector (4-byte signature) to filter
   * @returns Promise<TransactionData | undefined> - Transaction data if found, undefined if not found
   */
  fetchRandomTransaction(
    chainId: number,
    address: string,
    selector: string,
  ): Promise<TransactionData | undefined>;
}
