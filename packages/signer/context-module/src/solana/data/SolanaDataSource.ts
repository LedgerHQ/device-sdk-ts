import { type Either } from "purify-ts";

import type {
  SolanaTransactionContext,
  SolanaTransactionContextResult,
} from "@/solana/domain/solanaContextTypes";

export interface SolanaDataSource {
  getSolanaContext(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, SolanaTransactionContextResult>>;
}
