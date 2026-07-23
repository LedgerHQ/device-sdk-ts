import { ContainerModule } from "inversify";

import { ecdhTypes } from "@internal/use-cases/ecdh/di/ecdhTypes";
import { GetECDHSecretUseCase } from "@internal/use-cases/ecdh/GetECDHSecretUseCase";

export const ecdhModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ecdhTypes.GetECDHSecretUseCase).to(GetECDHSecretUseCase);
  });
