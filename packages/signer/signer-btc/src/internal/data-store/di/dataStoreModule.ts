import { ContainerModule } from "inversify";

import { dataStoreTypes } from "@internal/data-store/di/dataStoreTypes";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";

export const dataStoreModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(dataStoreTypes.DataStoreService).to(DefaultDataStoreService);
  });
