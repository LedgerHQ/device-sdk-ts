import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/transaction-check/data/HttpTransactionCheckDataSource";
import { HttpTypedDataCheckDataSource } from "@/transaction-check/data/HttpTypedDataCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";
import { TransactionCheckContextLoader } from "@/transaction-check/domain/TransactionCheckContextLoader";
import { TypedDataCheckContextLoader } from "@/transaction-check/domain/TypedDataCheckContextLoader";

export const transactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(transactionCheckTypes.TransactionCheckContextLoader).to(
      TransactionCheckContextLoader,
    );
    bind(transactionCheckTypes.TypedDataCheckDataSource).to(
      HttpTypedDataCheckDataSource,
    );
    bind(transactionCheckTypes.TypedDataCheckContextLoader).to(
      TypedDataCheckContextLoader,
    );
  });
