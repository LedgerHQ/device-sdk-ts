import { ContainerModule } from "inversify";

import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { SignMessageUseCase } from "@internal/use-cases/sign-message/SignMessageUseCase";
import { SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/sign-transaction/SignTransactionUseCase";

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
      bind(useCasesTypes.GetExtendedPublicKeyUseCase).to(
        GetExtendedPublicKeyUseCase,
      );
      bind(useCasesTypes.SignMessageUseCase).to(SignMessageUseCase);
      bind(useCasesTypes.SignPsbtUseCase).to(SignPsbtUseCase);
      bind(useCasesTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    },
  );
