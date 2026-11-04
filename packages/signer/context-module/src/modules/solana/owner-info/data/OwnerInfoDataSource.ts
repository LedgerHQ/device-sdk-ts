import { type Either } from "purify-ts";

import type { SolanaTransactionContext } from "@/modules/solana/model/SolanaTransactionContext";

export type HttpOwnerInfoDataSourceResult = {
  tlvDescriptor: Uint8Array;
  tokenAccount: string;
  owner: string;
};

export interface OwnerInfoDataSource {
  getOwnerInfo(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, HttpOwnerInfoDataSourceResult>>;
}
