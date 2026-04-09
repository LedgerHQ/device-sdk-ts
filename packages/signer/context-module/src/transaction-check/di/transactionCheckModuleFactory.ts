import { ContainerModule } from "inversify";

import { HttpTransactionCheckDataSource } from "@/transaction-check/data/HttpTransactionCheckDataSource";
import { HttpTypedDataCheckDataSource } from "@/transaction-check/data/HttpTypedDataCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";
import { EthereumTransactionCheckContextLoader } from "@/transaction-check/domain/EthereumTransactionCheckContextLoader";
import { SolanaTransactionCheckContextLoader } from "@/transaction-check/domain/SolanaTransactionCheckContextLoader";
import { TypedDataCheckContextLoader } from "@/transaction-check/domain/TypedDataCheckContextLoader";

export const transactionCheckModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionCheckTypes.TransactionCheckDataSource).to(
      HttpTransactionCheckDataSource,
    );
    bind(transactionCheckTypes.EthereumTransactionCheckContextLoader).to(
      EthereumTransactionCheckContextLoader,
    );
    bind(transactionCheckTypes.SolanaTransactionCheckContextLoader).to(
      SolanaTransactionCheckContextLoader,
    );
    bind(transactionCheckTypes.TypedDataCheckDataSource).to(
      HttpTypedDataCheckDataSource,
    );
    bind(transactionCheckTypes.TypedDataCheckContextLoader).to(
      TypedDataCheckContextLoader,
    );
  });
