import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(AleoAppBinder);
  });
