import { ContainerModule } from "inversify";

import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TestBatchTypedDataFromFileUseCase } from "@root/src/application/usecases/TestBatchTypedDataFromFileUseCase";
import { TestTransactionUseCase } from "@root/src/application/usecases/TestTransactionUseCase";
import { TestTypedDataUseCase } from "@root/src/application/usecases/TestTypedDataUseCase";
import { TYPES } from "@root/src/di/types";
import { ResultDisplayService } from "@root/src/services/ResultDisplayService";

export const applicationModuleFactory = () =>
    new ContainerModule(({ bind }) => {
        bind(TYPES.TestTransactionUseCase).to(TestTransactionUseCase);
        bind(TYPES.TestBatchTransactionFromFileUseCase).to(
            TestBatchTransactionFromFileUseCase,
        );
        bind(TYPES.TestTypedDataUseCase).to(TestTypedDataUseCase);
        bind(TYPES.TestBatchTypedDataFromFileUseCase).to(
            TestBatchTypedDataFromFileUseCase,
        );
        bind(TYPES.ResultDisplayService)
            .to(ResultDisplayService)
            .inSingletonScope();
    });
