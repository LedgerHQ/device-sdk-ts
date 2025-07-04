import { ContainerModule } from "inversify";

import { HttpProxyDataSource } from "@/transaction/data/HttpProxyDataSource";
import { HttpTransactionDataSource } from "@/transaction/data/HttpTransactionDataSource";
import { transactionTypes } from "@/transaction/di/transactionTypes";
import { TransactionContextLoader } from "@/transaction/domain/TransactionContextLoader";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.TransactionDataSource).to(HttpTransactionDataSource);
    bind(transactionTypes.TransactionContextLoader).to(
      TransactionContextLoader,
    );
    bind(transactionTypes.ProxyDataSource).to(HttpProxyDataSource);
  });
