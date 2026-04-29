import { ContainerModule } from "inversify";

import { appConfigTypes } from "@internal/use-cases/app-config/di/appConfigTypes";
import { GetAppConfigUseCase } from "@internal/use-cases/app-config/GetAppConfigUseCase";

export const appConfigModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appConfigTypes.GetAppConfigUseCase).to(GetAppConfigUseCase);
  });
