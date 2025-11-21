import { type Either } from "purify-ts";

import { type SolanaTransactionDescriptorList } from "@/solanaLifi/domain/SolanaLifiContext";

export type GetTransactionDescriptorsParams = {
  templateId: string;
};

export type GetTransactionDescriptorsResponse = {
  [key: string]: unknown;
  descriptors: SolanaTransactionDescriptorList;
};

export interface SolanaLifiDataSource {
  getTransactionDescriptorsPayload(
    params: GetTransactionDescriptorsParams,
  ): Promise<Either<Error, GetTransactionDescriptorsResponse>>;
}
