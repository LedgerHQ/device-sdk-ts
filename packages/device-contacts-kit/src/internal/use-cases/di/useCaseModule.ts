import { ContainerModule } from "inversify";

import { RegisterExternalAddressUseCase } from "@internal/use-cases/RegisterExternalAddressUseCase";
import { RegisterLedgerAccountUseCase } from "@internal/use-cases/RegisterLedgerAccountUseCase";

import { useCaseTypes } from "./useCaseTypes";

export const useCaseModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCaseTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
    bind(useCaseTypes.RegisterLedgerAccountUseCase).to(
      RegisterLedgerAccountUseCase,
    );
  });
