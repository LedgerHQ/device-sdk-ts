import { ContainerModule } from "inversify";

import { AuthenticateUseCase } from "@internal/use-cases/authentication/AuthenticateUseCase";
import { DecryptDataUseCase } from "@internal/use-cases/authentication/DecryptDataUseCase";
import { EncryptDataUseCase } from "@internal/use-cases/authentication/EncryptDataUseCase";
import { LedgerIdentityDecryptUseCase } from "@internal/use-cases/ledger-identity/LedgerIdentityDecryptUseCase";
import { LedgerIdentityEncryptUseCase } from "@internal/use-cases/ledger-identity/LedgerIdentityEncryptUseCase";

import { useCasesTypes } from "./useCasesTypes";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.AuthenticateUseCase).to(AuthenticateUseCase);
    bind(useCasesTypes.EncryptDataUseCase).to(EncryptDataUseCase);
    bind(useCasesTypes.DecryptDataUseCase).to(DecryptDataUseCase);
    bind(useCasesTypes.LedgerIdentityEncryptUseCase).to(
      LedgerIdentityEncryptUseCase,
    );
    bind(useCasesTypes.LedgerIdentityDecryptUseCase).to(
      LedgerIdentityDecryptUseCase,
    );
  });
