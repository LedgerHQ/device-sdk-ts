import { ContainerModule } from "inversify";

import { publicKeyTypes } from "@internal/use-cases/publickey/di/publicKeyTypes";
import { GetPublicKeyUseCase } from "@internal/use-cases/publickey/GetPublicKeyUseCase";

export const publicKeyModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(publicKeyTypes.GetPublicKeyUseCase).to(GetPublicKeyUseCase);
  });
