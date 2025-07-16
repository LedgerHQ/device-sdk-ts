import { type Either } from "purify-ts";

import { type TransactionMapperResult } from "./model/TransactionMapperResult";

export interface TransactionMapperService {
  mapTransactionToSubset: (
    transaction: Uint8Array,
  ) => Either<Error, TransactionMapperResult>;
}
