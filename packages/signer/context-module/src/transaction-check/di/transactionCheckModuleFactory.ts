import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/transaction-check/data/HttpTransactionCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";
import { TransactionCheckContextLoader } from "@/transaction-check/domain/TransactionCheckContextLoader";

export const transactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(transactionCheckTypes.TransactionCheckContextLoader).to(
      TransactionCheckContextLoader,
    );
  });
