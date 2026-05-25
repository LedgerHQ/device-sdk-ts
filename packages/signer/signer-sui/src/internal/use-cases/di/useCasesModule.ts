import { ContainerModule } from "inversify";

import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { SignPersonalMessageUseCase } from "@internal/use-cases/message/SignPersonalMessageUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";
import { GetVersionUseCase } from "@internal/use-cases/version/GetVersionUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.GetAddressUseCase).to(GetAddressUseCase);
    bind(useCasesTypes.GetVersionUseCase).to(GetVersionUseCase);
    bind(useCasesTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(useCasesTypes.SignPersonalMessageUseCase).to(
      SignPersonalMessageUseCase,
    );
  });
