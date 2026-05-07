import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/HttpTransactionCheckDataSource";
import { transactionCheckTypes } from "@/modules/multichain/transaction-check/di/transactionCheckTypes";
import { EthereumTransactionCheckLoader } from "@/modules/multichain/transaction-check/loaders/EthereumTransactionCheckLoader";
import { EthereumTypedDataCheckLoader } from "@/modules/multichain/transaction-check/loaders/EthereumTypedDataCheckLoader";

export const ethereumTransactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(transactionCheckTypes.TransactionCheckLoader).to(
      EthereumTransactionCheckLoader,
    );
    bind(transactionCheckTypes.TypedDataCheckLoader).to(
      EthereumTypedDataCheckLoader,
    );
  });
