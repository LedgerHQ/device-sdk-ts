import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
  });
