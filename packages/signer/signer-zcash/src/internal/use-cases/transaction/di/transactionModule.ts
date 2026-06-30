import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { GetTrustedInputUseCase } from "@internal/use-cases/transaction/GetTrustedInputUseCase";
import { SignPcztTransactionUseCase } from "@internal/use-cases/transaction/SignPcztTransactionUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.GetTrustedInputUseCase).to(GetTrustedInputUseCase);
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(transactionTypes.SignPcztTransactionUseCase).to(
      SignPcztTransactionUseCase,
    );
  });
