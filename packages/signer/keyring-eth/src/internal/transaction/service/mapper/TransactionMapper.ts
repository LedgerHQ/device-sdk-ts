import { type Maybe } from "purify-ts";

import { type Transaction } from "@api/index";

import { type TransactionMapperResult } from "./model/TransactionMapperResult";

export interface TransactionMapper {
  map(transaction: Transaction): Maybe<TransactionMapperResult>;
}
