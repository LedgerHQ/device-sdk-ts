import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { EthersV5TransactionMapper } from "@internal/transaction/service/mapper/EthersV5TransactionMapper";
import { EthersV6TransactionMapper } from "@internal/transaction/service/mapper/EthersV6TransactionMapper";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
      bind(transactionTypes.TransactionMapperService).to(
        TransactionMapperService,
      );
      bind(transactionTypes.TransactionMappers).to(EthersV5TransactionMapper);
      bind(transactionTypes.TransactionMappers).to(EthersV6TransactionMapper);
    },
  );
