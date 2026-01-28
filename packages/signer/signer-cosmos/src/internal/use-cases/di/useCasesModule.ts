import { ContainerModule } from "inversify";

import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.GetAddressUseCase).to(GetAddressUseCase);
    bind(useCasesTypes.SignTransactionUseCase).to(SignTransactionUseCase);
  });
