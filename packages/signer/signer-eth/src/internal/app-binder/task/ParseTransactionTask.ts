import { type TransactionSubset } from "@ledgerhq/context-module";

import { type TransactionType } from "@api/model/TransactionType";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type ParseTransactionTaskResult = {
  readonly subset: TransactionSubset;
  readonly type: TransactionType;
};

export type ParseTransactionTaskArgs = {
  readonly mapper: TransactionMapperService;
  readonly transaction: Uint8Array;
};

export class ParseTransactionTask {
  constructor(private readonly _args: ParseTransactionTaskArgs) {}

  run(): ParseTransactionTaskResult {
    const { mapper, transaction } = this._args;

    const { subset, type } = mapper
      .mapTransactionToSubset(transaction)
      .unsafeCoerce();
    return { subset, type };
  }
}
