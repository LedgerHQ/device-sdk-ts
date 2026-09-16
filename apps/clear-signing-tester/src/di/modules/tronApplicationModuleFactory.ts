import { ContainerModule } from "inversify";

import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TYPES } from "@root/src/di/types";

export const tronApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestBatchTronTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
  });
