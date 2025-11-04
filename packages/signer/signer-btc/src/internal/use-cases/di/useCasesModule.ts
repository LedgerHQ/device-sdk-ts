import { ContainerModule } from "inversify";

import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { GetWalletAddressUseCase } from "@internal/use-cases/get-wallet-address/GetWalletAddressUseCase";
import { RegisterWalletPolicyUseCase } from "@internal/use-cases/register-wallet-policy/RegisterWalletPolicyUseCase";
import { SignMessageUseCase } from "@internal/use-cases/sign-message/SignMessageUseCase";
import { SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/sign-transaction/SignTransactionUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.GetExtendedPublicKeyUseCase).to(
      GetExtendedPublicKeyUseCase,
    );
    bind(useCasesTypes.SignMessageUseCase).to(SignMessageUseCase);
    bind(useCasesTypes.SignPsbtUseCase).to(SignPsbtUseCase);
    bind(useCasesTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(useCasesTypes.GetWalletAddressUseCase).to(GetWalletAddressUseCase);
    bind(useCasesTypes.RegisterWalletPolicyTask).to(
      RegisterWalletPolicyUseCase,
    );
  });
