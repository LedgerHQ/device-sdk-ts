import { ContainerModule } from "inversify";

import { AuthenticateUseCase } from "@internal/use-cases/authentication/AuthenticateUseCase";

import { useCasesTypes } from "./useCasesTypes";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.AuthenticateUseCase).to(AuthenticateUseCase);
  });
