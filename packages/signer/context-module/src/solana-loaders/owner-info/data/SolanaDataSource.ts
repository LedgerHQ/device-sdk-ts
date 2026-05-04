import { type Either } from "purify-ts";

import type { SolanaTransactionContext } from "@/shared/model/SolanaTransactionContext";

export type HttpSolanaOwnerInfoDataSourceResult = {
  tlvDescriptor: Uint8Array;
};

export interface SolanaDataSource {
  getOwnerInfo(
    params: SolanaTransactionContext,
  ): Promise<Either<Error, HttpSolanaOwnerInfoDataSourceResult>>;
}
