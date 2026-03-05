import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { SignFeeIntentUseCase } from "@internal/use-cases/transaction/SignFeeIntentUseCase";
import { SignRootIntentUseCase } from "@internal/use-cases/transaction/SignRootIntentUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignRootIntentUseCase).to(SignRootIntentUseCase);
    bind(transactionTypes.SignFeeIntentUseCase).to(SignFeeIntentUseCase);
  });
