import { ContainerModule } from "inversify";

import { dataStoreTypes } from "@internal/data-store/di/dataStoreTypes";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";

export const dataStoreModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(dataStoreTypes.DataStoreService).to(DefaultDataStoreService);
    },
  );
