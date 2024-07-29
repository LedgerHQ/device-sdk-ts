import { injectable, multiInject } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { Transaction } from "@api/index";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";

import { TransactionMapperResult } from "./model/TransactionMapperResult";
import { TransactionMapper } from "./TransactionMapper";

@injectable()
export class TransactionMapperService {
  private _mappers: TransactionMapper[];

  constructor(
    @multiInject(transactionTypes.TransactionMappers)
    mappers: TransactionMapper[],
  ) {
    this._mappers = mappers;
  }

  mapTransactionToSubset(
    transaction: Transaction,
  ): Either<Error, TransactionMapperResult> {
    for (const mapper of this._mappers) {
      const result = mapper.map(transaction);
      if (result.isJust()) {
        return Right(result.extract());
      }
    }

    // TODO: handle correctly with the future error type
    return Left(new Error("Unsupported transaction type"));
  }
}
