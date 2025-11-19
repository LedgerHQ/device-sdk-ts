import type { TransactionData } from "@root/src/domain/models/TransactionData";

/**
 * Transaction Crafter Interface
 *
 * Provides abstraction for crafting raw transactions from TransactionData.
 * Different implementations can use different libraries (ethers, web3, etc.).
 */
export interface TransactionCrafter {
  /**
   * Craft a raw transaction from TransactionData and chain ID
   * @param transactionData - The transaction data to craft
   * @param chainId - The blockchain chain ID
   * @returns The raw transaction as a hexadecimal string
   */
  craftRawTransaction(
    transactionData: TransactionData,
    chainId: number,
  ): string;

  /**
   * Unsign a raw transaction
   * @param rawTransaction - The raw transaction to unsign
   * @returns The unsigned raw transaction as a hexadecimal string
   */
  unsignRawTransaction(rawTransaction: string): string;
}
