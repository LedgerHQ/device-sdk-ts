import { ContainerModule } from "inversify";

import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TYPES } from "@root/src/di/types";

export const btcLegacyApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestBatchBtcLegacyTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
  });
