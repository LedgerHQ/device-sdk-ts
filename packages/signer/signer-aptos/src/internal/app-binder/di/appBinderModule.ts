import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AptosAppBinder } from "@internal/app-binder/AptosAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(AptosAppBinder);
  });
