import { ContainerModule } from "inversify";

import { TestBatchContactFromFileUseCase } from "@root/src/application/usecases/TestBatchContactFromFileUseCase";
import { TestBatchContractFromFileUseCase } from "@root/src/application/usecases/TestBatchContractFromFileUseCase";
import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TestBatchTypedDataFromFileUseCase } from "@root/src/application/usecases/TestBatchTypedDataFromFileUseCase";
import { TestContactUseCase } from "@root/src/application/usecases/TestContactUseCase";
import { TestContractUseCase } from "@root/src/application/usecases/TestContractUseCase";
import { TestTransactionUseCase } from "@root/src/application/usecases/TestTransactionUseCase";
import { TestTypedDataUseCase } from "@root/src/application/usecases/TestTypedDataUseCase";
import { TYPES } from "@root/src/di/types";

export const ethereumApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestTransactionUseCase).to(TestTransactionUseCase);
    bind(TYPES.TestBatchTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
    bind(TYPES.TestTypedDataUseCase).to(TestTypedDataUseCase);
    bind(TYPES.TestBatchTypedDataFromFileUseCase).to(
      TestBatchTypedDataFromFileUseCase,
    );
    bind(TYPES.TestContractUseCase).to(TestContractUseCase);
    bind(TYPES.TestBatchContractFromFileUseCase).to(
      TestBatchContractFromFileUseCase,
    );
    bind(TYPES.TestContactUseCase).to(TestContactUseCase);
    bind(TYPES.TestBatchContactFromFileUseCase).to(
      TestBatchContactFromFileUseCase,
    );
  });
