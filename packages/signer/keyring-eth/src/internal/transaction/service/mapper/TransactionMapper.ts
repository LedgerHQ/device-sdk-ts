import { TransactionSubset } from "@ledgerhq/context-module";
import { Maybe } from "purify-ts";

import { Transaction } from "@api/index";

export interface TransactionMapper {
  map(transaction: Transaction): Maybe<TransactionSubset>;
}
