import { ContainerModule } from "inversify";

import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

export const appBinderModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinder).to(CosmosAppBinder);
  });
