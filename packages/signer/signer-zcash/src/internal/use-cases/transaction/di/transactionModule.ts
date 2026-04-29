import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { GetTrustedInputUseCase } from "@internal/use-cases/transaction/GetTrustedInputUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.GetTrustedInputUseCase).to(GetTrustedInputUseCase);
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
  });
