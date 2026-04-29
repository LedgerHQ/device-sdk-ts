import { ContainerModule } from "inversify";

import { CraftTransactionUseCase } from "@internal/use-cases/craft-transaction/CraftTransactionUseCase";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { GenerateTransactionUseCase } from "@internal/use-cases/generate-transaction/GenerateTransactionUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.GenerateTransactionUseCase).to(
      GenerateTransactionUseCase,
    );
    bind(useCasesTypes.CraftTransactionUseCase).to(CraftTransactionUseCase);
  });
