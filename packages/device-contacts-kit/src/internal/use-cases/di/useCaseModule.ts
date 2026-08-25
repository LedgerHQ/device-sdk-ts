import { ContainerModule } from "inversify";

import { RegisterExternalAddressUseCase } from "@internal/use-cases/RegisterExternalAddressUseCase";
import { RenameContactUseCase } from "@internal/use-cases/RenameContactUseCase";

import { useCaseTypes } from "./useCaseTypes";

export const useCaseModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCaseTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
    bind(useCaseTypes.RenameContactUseCase).to(RenameContactUseCase);
  });
