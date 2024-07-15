import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { TransactionMapperService } from "@internal/transaction/service/TransactionMapperService";
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
    },
  );
