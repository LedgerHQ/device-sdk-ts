import { ContainerModule } from "inversify";

import { TestTransactionUseCase } from "../../application/usecases/TestTransactionUseCase";
import { TestBatchTransactionFromFileUseCase } from "../../application/usecases/TestBatchTransactionFromFileUseCase";
import { TestTypedDataUseCase } from "../../application/usecases/TestTypedDataUseCase";
import { TestBatchTypedDataFromFileUseCase } from "../../application/usecases/TestBatchTypedDataFromFileUseCase";
import { ResultDisplayService } from "../../services/ResultDisplayService";
import { TYPES } from "../types";

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
