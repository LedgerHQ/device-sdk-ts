import { ContainerModule } from "inversify";

import { TestBatchContactFromFileUseCase } from "@root/src/application/usecases/TestBatchContactFromFileUseCase";
import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TestBatchTypedDataFromFileUseCase } from "@root/src/application/usecases/TestBatchTypedDataFromFileUseCase";
import { TestContactUseCase } from "@root/src/application/usecases/TestContactUseCase";
import { TYPES } from "@root/src/di/types";

export const ethereumApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestBatchTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
    bind(TYPES.TestBatchTypedDataFromFileUseCase).to(
      TestBatchTypedDataFromFileUseCase,
    );
    bind(TYPES.TestContactUseCase).to(TestContactUseCase);
    bind(TYPES.TestBatchContactFromFileUseCase).to(
      TestBatchContactFromFileUseCase,
    );
  });
