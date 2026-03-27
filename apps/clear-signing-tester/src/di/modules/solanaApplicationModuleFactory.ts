import { ContainerModule } from "inversify";

import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TestSolanaProgramUseCase } from "@root/src/application/usecases/TestSolanaProgramUseCase";
import { TestSolanaTransactionUseCase } from "@root/src/application/usecases/TestSolanaTransactionUseCase";
import { TYPES } from "@root/src/di/types";

export const solanaApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestSolanaTransactionUseCase).to(TestSolanaTransactionUseCase);
    bind(TYPES.TestBatchSolanaTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
    bind(TYPES.TestSolanaProgramUseCase).to(TestSolanaProgramUseCase);
  });
