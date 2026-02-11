import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { CeloAppBinder } from "@internal/app-binder/CeloAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(CeloAppBinder);
  });
