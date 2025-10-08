import {
  type SolanaTransactionContext,
  type SolanaTransactionContextResult,
} from "./solanaContextTypes";

export interface SolanaContextLoader {
  load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult>;
}
