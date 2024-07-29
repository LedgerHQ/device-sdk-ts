import { Maybe } from "purify-ts";

import { Transaction } from "@api/index";

import { TransactionMapperResult } from "./model/TransactionMapperResult";

export interface TransactionMapper {
  map(transaction: Transaction): Maybe<TransactionMapperResult>;
}
