import { type SolanaTransactionData } from "@root/src/domain/models/SolanaTransactionData";

export interface SolanaRpcAdapter {
  /**
   * Fetch recent clear-signable transactions for a Solana address.
   * Works with both program IDs and wallet addresses. Internally fetches
   * signatures, retrieves full transactions, filters to those whose
   * instructions only use clear-signable programs, groups by instruction
   * category, and picks random transactions per category.
   *
   * @param address - Solana address (base-58) — typically a program ID
   * @param limit - Maximum number of signatures to scan (default 100)
   * @param samplesPerInstruction - Number of transactions to pick per instruction type (default 1)
   */
  fetchClearSignableTransactions(
    address: string,
    limit?: number,
    samplesPerInstruction?: number,
  ): Promise<SolanaTransactionData[]>;
}
