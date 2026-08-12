import { ContainerModule } from "inversify";

import { RegisterExternalAddressUseCase } from "@internal/use-cases/RegisterExternalAddressUseCase";

import { useCaseTypes } from "./useCaseTypes";

export const useCaseModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCaseTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
  });
