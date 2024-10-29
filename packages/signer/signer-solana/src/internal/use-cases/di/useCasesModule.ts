import { ContainerModule } from "inversify";

import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";

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
    },
  );
