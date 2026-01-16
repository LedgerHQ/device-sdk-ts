import { type Either } from "purify-ts";

import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

export type HttpSolanaOwnerInfoDataSourceResult = {
  tlvDescriptor: Uint8Array;
};

export interface SolanaDataSource {
  getOwnerInfo(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, HttpSolanaOwnerInfoDataSourceResult>>;
}
