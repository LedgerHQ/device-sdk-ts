import { type Either } from "purify-ts";

import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

export type HttpSolanaOwnerInfoDataSourceResult = {
  descriptor: Uint8Array;
  tokenAccount: string;
  owner: string;
  contract: string;
};

export interface SolanaDataSource {
  getOwnerInfo(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, HttpSolanaOwnerInfoDataSourceResult>>;
}
