import type { TransactionData } from "@root/src/domain/models/TransactionData";

/**
 * Etherscan Adapter Interface
 *
 * Provides abstraction for interacting with Etherscan API.
 * Allows fetching random transaction by chain ID, address, and function selector.
 */
export interface EtherscanAdapter {
  /**
   * Fetch random transactions filtered by chain ID, address, and optionally selectors
   * @param chainId - The blockchain chain ID
   * @param address - The contract address to filter transactions
   * @param selectors - Optional function selectors (4-byte signatures) to filter. If not provided, returns one transaction per unique selector found.
   * @returns Promise<TransactionData[]> - Array of transaction data, one per selector if found
   */
  fetchRandomTransaction(
    chainId: number,
    address: string,
    selectors?: string[],
  ): Promise<TransactionData[]>;
}
