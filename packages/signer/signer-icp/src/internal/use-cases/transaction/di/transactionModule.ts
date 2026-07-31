import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";
import { SignUpdateCallUseCase } from "@internal/use-cases/transaction/SignUpdateCallUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(transactionTypes.SignUpdateCallUseCase).to(SignUpdateCallUseCase);
  });
