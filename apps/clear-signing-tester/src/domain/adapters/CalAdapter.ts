/**
 * CAL Adapter Interface
 *
 * Provides abstraction for interacting with Ledger's Crypto Assets Ledger (CAL) service.
 * The CAL service provides calldata descriptors, token information, and other metadata
 * for smart contracts across different blockchains.
 */
export interface CalAdapter {
  /**
   * Fetch function selectors for a given contract address and chain ID
   * @param chainId - The blockchain chain ID
   * @param contractAddress - The contract address to fetch selectors for
   * @returns Promise<string[]> - Array of function selectors
   */
  fetchSelectors(chainId: number, contractAddress: string): Promise<string[]>;
}
