import { type Either } from "purify-ts";

import type { SolanaTransactionContext } from "@/modules/solana/model/SolanaTransactionContext";

export type HttpOwnerInfoDataSourceResult = {
  tlvDescriptor: Uint8Array;
};

export interface OwnerInfoDataSource {
  getOwnerInfo(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, HttpOwnerInfoDataSourceResult>>;
}
