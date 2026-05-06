import { type Either } from "purify-ts";

import type { GetTransactionDescriptorsResponse } from "@/shared/model/SolanaContextTypes";

export type GetTransactionDescriptorsParams = {
  templateId: string;
};

export type { GetTransactionDescriptorsResponse };

export interface LifiDataSource {
  getTransactionDescriptorsPayload(
    params: GetTransactionDescriptorsParams,
  ): Promise<Either<Error, GetTransactionDescriptorsResponse>>;
}
