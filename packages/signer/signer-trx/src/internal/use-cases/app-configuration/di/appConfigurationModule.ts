import { ContainerModule } from "inversify";

import { appConfigurationTypes } from "@internal/use-cases/app-configuration/di/appConfigurationTypes";
import { GetAppConfigurationUseCase } from "@internal/use-cases/app-configuration/GetAppConfigurationUseCase";

export const appConfigurationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appConfigurationTypes.GetAppConfigurationUseCase).to(
      GetAppConfigurationUseCase,
    );
  });
