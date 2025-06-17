import { type Either } from "purify-ts";

import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

export type HttpSolanaDataSourceResult = {
  descriptor: Uint8Array;
  tokenAccount: string;
  owner: string;
  contract: string;
};

export interface SolanaDataSource {
  getSolanaContext(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, HttpSolanaDataSourceResult>>;
}
