import { ContainerModule } from "inversify";

import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { GetAppConfigurationUseCase } from "@internal/use-cases/app-configuration/GetAppConfigurationUseCase";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(useCasesTypes.GetAddressUseCase).to(GetAddressUseCase);
      bind(useCasesTypes.GetAppConfigurationUseCase).to(
        GetAppConfigurationUseCase,
      );
      bind(useCasesTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    },
  );
