import { type Either } from "purify-ts";

import { type SolanaTransactionDescriptorList } from "@/shared/model/SolanaContextTypes";

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
