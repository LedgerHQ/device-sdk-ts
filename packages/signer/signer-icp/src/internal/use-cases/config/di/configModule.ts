import { ContainerModule } from "inversify";

import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { GetAppConfigurationUseCase } from "@internal/use-cases/config/GetAppConfigurationUseCase";

export const configModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(configTypes.GetAppConfigurationUseCase).to(GetAppConfigurationUseCase);
  });
