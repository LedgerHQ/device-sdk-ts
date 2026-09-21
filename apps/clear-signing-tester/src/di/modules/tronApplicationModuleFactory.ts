import { ContainerModule } from "inversify";

import { TestBatchContactFromFileUseCase } from "@root/src/application/usecases/TestBatchContactFromFileUseCase";
import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TestContactUseCase } from "@root/src/application/usecases/TestContactUseCase";
import { TYPES } from "@root/src/di/types";

export const tronApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestBatchTronTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
    bind(TYPES.TestContactUseCase).to(TestContactUseCase);
    bind(TYPES.TestBatchContactFromFileUseCase).to(
      TestBatchContactFromFileUseCase,
    );
  });
