import { ContainerModule } from "inversify";

import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { GetAppConfigurationUseCase } from "@internal/use-cases/app-configuration/GetAppConfigurationUseCase";
import { CraftTransactionUseCase } from "@internal/use-cases/craft-transaction/CraftTransactionUseCase";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { GenerateTransactionUseCase } from "@internal/use-cases/generateTransaction/GenerateTransactionUseCase";
import { SignMessageUseCase } from "@internal/use-cases/message/SignMessageUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.GetAddressUseCase).to(GetAddressUseCase);
    bind(useCasesTypes.GetAppConfigurationUseCase).to(
      GetAppConfigurationUseCase,
    );
    bind(useCasesTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(useCasesTypes.SignMessageUseCase).to(SignMessageUseCase);
    bind(useCasesTypes.GenerateTransactionUseCase).to(
      GenerateTransactionUseCase,
    );
    bind(useCasesTypes.CraftTransactionUseCase).to(CraftTransactionUseCase);
  });
