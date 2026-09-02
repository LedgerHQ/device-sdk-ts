import { ContainerModule } from "inversify";

import { catalogTypes } from "@internal/catalog/di/catalogTypes";
import { AppCatalogService } from "@internal/catalog/service/AppCatalogService";

export const catalogModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(catalogTypes.AppCatalogService)
      .to(AppCatalogService)
      .inSingletonScope();
  });
