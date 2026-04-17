import { ContainerModule } from "inversify";

import { verifyAddressTypes } from "@internal/use-cases/verify-address/di/verifyAddressTypes";
import { VerifyAddressUseCase } from "@internal/use-cases/verify-address/VerifyAddressUseCase";

export const verifyAddressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(verifyAddressTypes.VerifyAddressUseCase).to(VerifyAddressUseCase);
  });
