import { type SolanaTransactionData } from "@root/src/domain/models/SolanaTransactionData";

export interface SolanaRpcAdapter {
  /**
   * Fetch recent transactions for a Solana address.
   *
   * When distill is false (default), successful transactions are returned
   * as-is from the RPC with no filtering or modification — the craft step
   * handles payer replacement and format normalisation.
   *
   * When distill is true, each transaction is filtered to a single
   * clear-signable instruction from the target program and distilled into
   * a minimal single-instruction transaction the Ledger app can parse.
   *
   * @param address - Solana address (base-58) — typically a program ID
   * @param limit - Maximum number of signatures to scan (default 500)
   * @param samplesPerInstruction - Number of transactions to pick per category (default 1)
   * @param distill - Enable distillation and instruction filtering (default false)
   */
  fetchClearSignableTransactions(
    address: string,
    limit?: number,
    samplesPerInstruction?: number,
    distill?: boolean,
  ): Promise<SolanaTransactionData[]>;
}
