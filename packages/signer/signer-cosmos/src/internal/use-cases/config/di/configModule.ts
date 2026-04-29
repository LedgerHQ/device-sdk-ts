import { ContainerModule } from "inversify";

import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";

export const configModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(configTypes.GetAppConfigUseCase).to(GetAppConfigUseCase);
  });
