import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/loaders/shared/transaction-check/data/HttpTransactionCheckDataSource";
import { transactionCheckTypes } from "@/loaders/shared/transaction-check/di/transactionCheckTypes";
import { ethereumTransactionCheckTypes } from "@/loaders/shared/transaction-check/ethereum/di/ethereumTransactionCheckTypes";
import { EthereumTransactionCheckContextLoader } from "@/loaders/shared/transaction-check/ethereum/domain/EthereumTransactionCheckContextLoader";
import { EthereumTypedDataTransactionCheckContextLoader } from "@/loaders/shared/transaction-check/ethereum/domain/EthereumTypedDataTransactionCheckContextLoader";

export const ethereumTransactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(
      ethereumTransactionCheckTypes.EthereumTransactionCheckContextLoader,
    ).to(EthereumTransactionCheckContextLoader);
    bind(
      ethereumTransactionCheckTypes.EthereumTypedDataTransactionCheckContextLoader,
    ).to(EthereumTypedDataTransactionCheckContextLoader);
  });
