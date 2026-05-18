import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/HttpTransactionCheckDataSource";
import { transactionCheckTypes } from "@/modules/multichain/transaction-check/di/transactionCheckTypes";
import { SolanaTransactionCheckLoader } from "@/modules/multichain/transaction-check/loaders/SolanaTransactionCheckLoader";

export const solanaTransactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(transactionCheckTypes.TransactionCheckLoader).to(
      SolanaTransactionCheckLoader,
    );
  });
