import { ContainerModule } from "inversify";

import { AuthenticateUseCase } from "@internal/use-cases/authentication/AuthenticateUseCase";
import { DecryptDataUseCase } from "@internal/use-cases/authentication/DecryptDataUseCase";
import { EncryptDataUseCase } from "@internal/use-cases/authentication/EncryptDataUseCase";

import { useCasesTypes } from "./useCasesTypes";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.AuthenticateUseCase).to(AuthenticateUseCase);
    bind(useCasesTypes.EncryptDataUseCase).to(EncryptDataUseCase);
    bind(useCasesTypes.DecryptDataUseCase).to(DecryptDataUseCase);
  });
