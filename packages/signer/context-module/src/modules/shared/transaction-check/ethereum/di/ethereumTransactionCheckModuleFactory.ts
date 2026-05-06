import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/modules/shared/transaction-check/data/HttpTransactionCheckDataSource";
import { transactionCheckTypes } from "@/modules/shared/transaction-check/di/transactionCheckTypes";
import { transactionCheckTypes as ethereumTransactionCheckTypes } from "@/modules/shared/transaction-check/ethereum/di/transactionCheckTypes";
import { EthereumTransactionCheckContextLoader } from "@/modules/shared/transaction-check/ethereum/domain/EthereumTransactionCheckContextLoader";
import { EthereumTypedDataTransactionCheckContextLoader } from "@/modules/shared/transaction-check/ethereum/domain/EthereumTypedDataTransactionCheckContextLoader";

export const ethereumTransactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(ethereumTransactionCheckTypes.TransactionCheckContextLoader).to(
      EthereumTransactionCheckContextLoader,
    );
    bind(
      ethereumTransactionCheckTypes.TypedDataTransactionCheckContextLoader,
    ).to(EthereumTypedDataTransactionCheckContextLoader);
  });
