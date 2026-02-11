import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TezosAppBinder } from "@internal/app-binder/TezosAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(TezosAppBinder);
  });
