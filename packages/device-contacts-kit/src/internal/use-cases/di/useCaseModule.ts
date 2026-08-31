import { ContainerModule } from "inversify";

import { EditExternalAddressIdentifierUseCase } from "@internal/use-cases/EditExternalAddressIdentifierUseCase";
import { EditExternalAddressScopeUseCase } from "@internal/use-cases/EditExternalAddressScopeUseCase";
import { RegisterExternalAddressUseCase } from "@internal/use-cases/RegisterExternalAddressUseCase";
import { RenameContactUseCase } from "@internal/use-cases/RenameContactUseCase";

import { useCaseTypes } from "./useCaseTypes";

export const useCaseModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCaseTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
    bind(useCaseTypes.RenameContactUseCase).to(RenameContactUseCase);
    bind(useCaseTypes.EditExternalAddressIdentifierUseCase).to(
      EditExternalAddressIdentifierUseCase,
    );
    bind(useCaseTypes.EditExternalAddressScopeUseCase).to(
      EditExternalAddressScopeUseCase,
    );
  });
