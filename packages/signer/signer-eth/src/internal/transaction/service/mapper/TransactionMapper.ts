import { type Maybe } from "purify-ts";

import { type TransactionMapperResult } from "./model/TransactionMapperResult";

export interface TransactionMapper {
  map(transaction: Uint8Array): Maybe<TransactionMapperResult>;
}
