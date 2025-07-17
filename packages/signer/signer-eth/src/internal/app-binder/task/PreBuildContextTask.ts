import { type TransactionSubset } from "@ledgerhq/context-module";

import { type TransactionType } from "@api/model/TransactionType";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type PreBuildContextTaskResult = {
  readonly subset: TransactionSubset;
  readonly type: TransactionType;
};

export type PreBuildContextTaskArgs = {
  readonly mapper: TransactionMapperService;
  readonly transaction: Uint8Array;
};

export class PreBuildContextTask {
  constructor(private readonly _args: PreBuildContextTaskArgs) {}

  run(): PreBuildContextTaskResult {
    const { mapper, transaction } = this._args;

    const { subset, type } = mapper
      .mapTransactionToSubset(transaction)
      .unsafeCoerce();
    return { subset, type };
  }
}
