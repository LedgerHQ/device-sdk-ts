import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/modules/shared/transaction-check/data/HttpTransactionCheckDataSource";
import { transactionCheckTypes } from "@/modules/shared/transaction-check/di/transactionCheckTypes";
import { ethereumTransactionCheckTypes } from "@/modules/shared/transaction-check/ethereum/di/ethereumTransactionCheckTypes";
import { EthereumTransactionCheckContextLoader } from "@/modules/shared/transaction-check/ethereum/domain/EthereumTransactionCheckContextLoader";
import { EthereumTypedDataTransactionCheckContextLoader } from "@/modules/shared/transaction-check/ethereum/domain/EthereumTypedDataTransactionCheckContextLoader";

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
